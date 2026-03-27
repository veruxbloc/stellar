import { config as dotenvConfig } from "dotenv";
dotenvConfig();

const pk = process.env.PRIVATE_KEY;
const isValidKey = pk && /^0x[0-9a-fA-F]{64}$/.test(pk);

export default {
  solidity: "0.8.20",
  networks: {
    rskTestnet: {
      type: "http",
      url: "https://public-node.testnet.rsk.co",
      chainId: 31,
      ...(isValidKey ? { accounts: [pk] } : {}),
      gasPrice: 60000000,
    },
    rskMainnet: {
      type: "http",
      url: "https://public-node.rsk.co",
      chainId: 30,
      ...(isValidKey ? { accounts: [pk] } : {}),
      gasPrice: 60000000,
    },
  },
};
