import { ethers } from "ethers";
import { readFileSync } from "fs";
import { config as dotenvConfig } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenvConfig();

const __dirname = dirname(fileURLToPath(import.meta.url));

const artifact = JSON.parse(
  readFileSync(join(__dirname, "../artifacts/contracts/EscrowProject.sol/EscrowProject.json"), "utf8")
);

async function main() {
  const provider = new ethers.JsonRpcProvider("https://public-node.testnet.rsk.co");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Deploying con:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "tRBTC");

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(100, { gasPrice: 60000000n });
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();

  console.log("\n✅ EscrowProject deployado en:", address);
  console.log("   TX:", tx.hash);
  console.log("\n👉 Agregar a .env.local:");
  console.log("   NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=" + address);
  console.log("👉 Explorer: https://explorer.testnet.rsk.co/tx/" + tx.hash);
}

main().catch((e) => { console.error(e); process.exit(1); });
