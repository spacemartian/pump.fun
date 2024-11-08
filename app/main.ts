import * as anchor from "@coral-xyz/anchor";
import { BondingCurve } from "../target/types/bonding_curve";
import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction, ComputeBudgetProgram, SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js"
import { getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "bn.js";

export const buyTokens = async (
  amount: number,
  tokenAddress: string,
  connectionUrl: string,
  walletSecretKey: string
) => {
  try {
    const connection = new Connection(connectionUrl);
    const program = anchor.workspace.BondingCurve as anchor.Program<BondingCurve>;
    const wallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(walletSecretKey)));

    const mint1 = new PublicKey(tokenAddress);
    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("liquidity_pool"), mint1.toBuffer()],
      program.programId
    );
    const poolToken = await getAssociatedTokenAddress(
      mint1, poolPda, true
    );
    const [poolSolVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("liquidity_sol_vault"), mint1.toBuffer()],
      program.programId
    );
    const [curveConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("CurveConfiguration")],
      program.programId
    );
    const userAta1 = await getAssociatedTokenAddress(
      mint1, wallet.publicKey
    );

    const tx = new Transaction()
      .add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
        await program.methods
          .buy(new BN(amount * 10 ** 9))
          .accounts({
            pool: poolPda,
            tokenMint: mint1,
            poolSolVault,
            poolTokenAccount: poolToken,
            userTokenAccount: userAta1,
            dexConfigurationAccount: curveConfig,
            user: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId
          })
          .instruction()
      );

    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const sig = await sendAndConfirmTransaction(connection, tx, [wallet], { skipPreflight: true });
    console.log("Successfully bought tokens: ", `https://solscan.io/tx/${sig}?cluster=devnet`);
  } catch (error) {
    console.log("Error in buy transaction:", error);
  }
};