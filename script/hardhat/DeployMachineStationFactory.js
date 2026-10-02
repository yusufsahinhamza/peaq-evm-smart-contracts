const { ethers } = require("hardhat");
const ERC1967ProxyArtifact = require("@openzeppelin/contracts/build/contracts/ERC1967Proxy.json");
require("dotenv").config();

async function main() {
    console.log("Starting MachineStationFactory PEAQ deployment...");

    // Get environment variables (following foundry script pattern)
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const adminAddress = process.env.ADMIN_ADDRESS;
    const stationManager = process.env.STATION_MANAGER_ADDRESS;
    const txRefundAmount = process.env.TX_REFUND_AMOUNT;

    // Validate environment variables
    if (!deployerPrivateKey) {
        throw new Error("DEPLOYER_PRIVATE_KEY environment variable is required");
    }
    if (!adminAddress) {
        throw new Error("ADMIN_ADDRESS environment variable is required");
    }
    if (!stationManager) {
        throw new Error("STATION_MANAGER_ADDRESS environment variable is required");
    }
    if (!txRefundAmount) {
        throw new Error("TX_REFUND_AMOUNT environment variable is required");
    }

    // Create deployer signer from private key
    const deployerWallet = new ethers.Wallet(deployerPrivateKey, ethers.provider);
    console.log("Deploying with account:", deployerWallet.address);

    // Get account balance
    const balance = await ethers.provider.getBalance(deployerWallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "Native Token");

    try {
        // Deploy implementation contracts
        console.log("Deploying implementation contracts...");
        const MachineSmartAccount = await ethers.getContractFactory("MachineSmartAccount", deployerWallet);
        const machineSmartAccountImpl = await MachineSmartAccount.deploy();
        await machineSmartAccountImpl.waitForDeployment();
        const machineSmartAccountImplAddress = await machineSmartAccountImpl.getAddress();
        console.log("✅ MachineSmartAccount implementation deployed to:", machineSmartAccountImplAddress);

        const MachineStationFactory = await ethers.getContractFactory("MachineStationFactory", deployerWallet);
        const factoryImpl = await MachineStationFactory.deploy();
        await factoryImpl.waitForDeployment();
        const factoryImplAddress = await factoryImpl.getAddress();
        console.log("✅ MachineStationFactory implementation deployed to:", factoryImplAddress);

        // Deploy UpgradeableBeacon for MachineSmartAccount
        console.log("Deploying UpgradeableBeacon...");
        const UpgradeableBeacon = await ethers.getContractFactory("UpgradeableBeacon", deployerWallet);
        const beacon = await UpgradeableBeacon.deploy(machineSmartAccountImplAddress, deployerWallet.address);
        await beacon.waitForDeployment();
        const beaconAddress = await beacon.getAddress();
        console.log("✅ UpgradeableBeacon deployed to:", beaconAddress);

        // Deploy factory proxy with initialization data
        console.log("Deploying MachineStationFactory proxy...");

        const proxyFactory = new ethers.ContractFactory(
            ERC1967ProxyArtifact.abi,
            ERC1967ProxyArtifact.bytecode,
            deployerWallet
        );

        const iface = new ethers.Interface(MachineStationFactory.interface.format("json"));
        const initData = iface.encodeFunctionData("initialize", [
            adminAddress,
            stationManager,
            beaconAddress,
            txRefundAmount
        ]);
        const proxy = await proxyFactory.deploy(factoryImplAddress, initData);
        await proxy.waitForDeployment();
        const proxyAddress = await proxy.getAddress();
        console.log("✅ MachineStationFactory proxy deployed to:", proxyAddress);

        const factory = MachineStationFactory.attach(proxyAddress);

        // Transfer beacon ownership to factory proxy
        console.log("Transferring beacon ownership to factory...");
        const beaconAsDeployer = beacon.connect(deployerWallet);
        const txOwnership = await beaconAsDeployer.transferOwnership(proxyAddress);
        await txOwnership.wait();
        console.log("✅ Beacon ownership transferred to factory");

        console.log("\n=== Deployment Summary ===");
        console.log("MachineSmartAccount implementation:", machineSmartAccountImplAddress);
        console.log("MachineStationFactory implementation:", factoryImplAddress);
        console.log("UpgradeableBeacon:", beaconAddress);
        console.log("MachineStationFactory proxy (use this address):", proxyAddress);
        console.log("Admin address:", adminAddress);
        console.log("Station Manager address:", stationManager);

        return factory;

    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        throw error;
    }
}

// Execute deployment
if (require.main === module) {
    main()
        .then(() => {
            console.log("🎉 Deployment completed successfully!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = main;
