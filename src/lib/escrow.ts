export const ESCROW_ADDRESS = "0x1aE5Ae84dDb18e0767033B316B2fe0F5B0f1A376";
export const RSK_TESTNET_CHAIN_ID = "0x1f"; // 31 en hex

export const ESCROW_ABI = [
  "function createProject(address payable _student, uint256 _deadline, string calldata _title, string calldata _description) external payable returns (uint256)",
  "function assignStudent(uint256 id, address payable _student) external",
  "function deliverWork(uint256 id) external",
  "function approveAndRelease(uint256 id) external",
  "function getProject(uint256 id) external view returns (tuple(address company, address student, uint256 amount, uint256 deadline, uint8 status, string title, string description))",
  "event ProjectCreated(uint256 indexed id, address company, uint256 amount, string title)",
  "event FundsReleased(uint256 indexed id, address student, uint256 amount)",
];
