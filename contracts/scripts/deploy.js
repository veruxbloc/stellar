import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying con:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(
    await hre.ethers.provider.getBalance(deployer.address)
  ), "tRBTC");

  const EscrowProject = await hre.ethers.getContractFactory("EscrowProject");
  const escrow = await EscrowProject.deploy(100);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("\n✅ EscrowProject deployado en:", address);
  console.log("   TX:", escrow.deploymentTransaction().hash);
  console.log("\n👉 Agregar a .env.local:");
  console.log("   NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=" + address);
  console.log("👉 Explorer: https://explorer.testnet.rsk.co/address/" + address);
}

main().catch((e) => { console.error(e); process.exit(1); });
