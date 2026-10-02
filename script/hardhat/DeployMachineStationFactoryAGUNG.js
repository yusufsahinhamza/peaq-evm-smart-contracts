const { ethers } = require("hardhat");
const ERC1967ProxyArtifact = require("@openzeppelin/contracts/build/contracts/ERC1967Proxy.json");
require("dotenv").config();

async function main() {
    console.log("Starting MachineStationFactory AGUNG deployment...");

    // Get environment variables (following foundry script pattern)
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const adminAddress = process.env.ADMIN_ADDRESS;
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    const stationManager = process.env.STATION_MANAGER_ADDRESS;
    // Uncomment below if you want to use the stationManager account to update the configs
    // const stationManagerPrivateKey = process.env.STATION_MANAGER_PRIVATE_KEY;

    const txRefundAmount = process.env.TX_REFUND_AMOUNT;

    const minBalanceKey = process.env.MIN_BALANCE_KEY;
    const minBalanceValueAgung = process.env.MIN_BALANCE_VALUE_AGUNG;

    const fundingAmountKey = process.env.FUNDING_AMOUNT_KEY;
    const fundingAmountValueAgung = process.env.FUNDING_AMOUNT_VALUE_AGUNG;

    // Validate environment variables
    if (!deployerPrivateKey) {
        throw new Error("DEPLOYER_PRIVATE_KEY environment variable is required");
    }
    if (!adminAddress) {
        throw new Error("ADMIN_ADDRESS environment variable is required");
    }
    if (!adminPrivateKey) {
        throw new Error("ADMIN_PRIVATE_KEY environment variable is required");
    }
    if (!stationManager) {
        throw new Error("STATION_MANAGER_ADDRESS environment variable is required");
    }
    if (!txRefundAmount) {
        throw new Error("TX_REFUND_AMOUNT environment variable is required");
    }
    if (!minBalanceKey) {
        throw new Error("MIN_BALANCE_KEY environment variable is required");
    }
    if (!minBalanceValueAgung) {
        throw new Error("MIN_BALANCE_VALUE_AGUNG environment variable is required");
    }
    if (!fundingAmountKey) {
        throw new Error("FUNDING_AMOUNT_KEY environment variable is required");
    }
    if (!fundingAmountValueAgung) {
        throw new Error("FUNDING_AMOUNT_VALUE_AGUNG environment variable is required");
    }

    // Create signers from private keys
    const deployerWallet = new ethers.Wallet(deployerPrivateKey, ethers.provider);
    const adminWallet = new ethers.Wallet(adminPrivateKey, ethers.provider);

    console.log("Deploying with account:", deployerWallet.address);
    console.log("Admin account:", adminWallet.address);

    // Verify admin address matches
    if (adminWallet.address.toLowerCase() !== adminAddress.toLowerCase()) {
        throw new Error("ADMIN_PRIVATE_KEY does not match ADMIN_ADDRESS");
    }

    // Get account balances
    const deployerBalance = await ethers.provider.getBalance(deployerWallet.address);
    const adminBalance = await ethers.provider.getBalance(adminWallet.address);
    console.log("Deployer balance:", ethers.formatEther(deployerBalance), "Native Token");
    console.log("Admin balance:", ethers.formatEther(adminBalance), "Native Token");

    try {
        // Hash the keys (following foundry script pattern)
        const minBalanceKeyHash = ethers.keccak256(ethers.toUtf8Bytes(minBalanceKey));
        const fundingAmountKeyHash = ethers.keccak256(ethers.toUtf8Bytes(fundingAmountKey));

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

        // Update configs with admin account using the private key
        console.log("Updating configs with admin account...");
        const factoryAsAdmin = factory.connect(adminWallet);

        console.log("Setting min balance config...");
        const tx1 = await factoryAsAdmin.updateConfigs(minBalanceKeyHash, minBalanceValueAgung);
        await tx1.wait();
        console.log("✅ Min balance config updated, tx hash:", tx1.hash);

        console.log("Setting funding amount config...");
        const tx2 = await factoryAsAdmin.updateConfigs(fundingAmountKeyHash, fundingAmountValueAgung);
        await tx2.wait();
        console.log("✅ Funding amount config updated, tx hash:", tx2.hash);

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
