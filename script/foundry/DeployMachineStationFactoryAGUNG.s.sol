// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MachineStationFactory} from "../../src/machine-station/MachineStationFactory.sol";
import {MachineSmartAccount} from "../../src/machine-station/MachineSmartAccount.sol";

contract DeployGasStation is Script {
    function run() external returns (MachineStationFactory) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        address adminAddress = vm.envAddress("ADMIN_ADDRESS");
        uint256 adminPrivateKey = vm.envUint("ADMIN_PRIVATE_KEY");

        address stationManager = vm.envAddress("STATION_MANAGER_ADDRESS");
        // Uncomment below if you want to use the stationManager account to update the configs
        // uint256 stationManagerPrivateKey = vm.envUint("STATION_MANAGER_PRIVATE_KEY");

        uint256 _txRefundAmount = uint256(vm.envInt("TX_REFUND_AMOUNT"));

        bytes32 minBalanceKey = keccak256(abi.encodePacked(vm.envString("MIN_BALANCE_KEY")));
        uint256 minBalanceValueAgung = uint256(vm.envInt("MIN_BALANCE_VALUE_AGUNG"));

        bytes32 fundingAmountKey = keccak256(abi.encodePacked(vm.envString("FUNDING_AMOUNT_KEY")));
        uint256 fundingAmountKeyAgung = uint256(vm.envInt("FUNDING_AMOUNT_VALUE_AGUNG"));

        // Deploy implementation contracts with deployer account
        vm.startBroadcast(deployerPrivateKey);
        MachineSmartAccount machineSmartAccountImpl = new MachineSmartAccount();
        MachineStationFactory factoryImpl = new MachineStationFactory();

        // Deploy UpgradeableBeacon for MachineSmartAccount
        UpgradeableBeacon beacon = new UpgradeableBeacon(address(machineSmartAccountImpl), msg.sender);

        // Deploy MachineStationFactory proxy with initialization data
        bytes memory factoryInitData = abi.encodeWithSelector(
            MachineStationFactory.initialize.selector,
            adminAddress,
            stationManager,
            address(beacon),
            _txRefundAmount
        );
        ERC1967Proxy factoryProxy = new ERC1967Proxy(address(factoryImpl), factoryInitData);

        // Transfer beacon ownership to factory proxy
        beacon.transferOwnership(address(factoryProxy));
        vm.stopBroadcast();

        // Update configs with admin account using the private key
        vm.startBroadcast(adminPrivateKey);
        MachineStationFactory factory = MachineStationFactory(payable(address(factoryProxy)));
        factory.updateConfigs(minBalanceKey, minBalanceValueAgung);
        factory.updateConfigs(fundingAmountKey, fundingAmountKeyAgung);
        vm.stopBroadcast();

        console.log("MachineSmartAccount implementation deployed to:", address(machineSmartAccountImpl));
        console.log("MachineStationFactory implementation deployed to:", address(factoryImpl));
        console.log("UpgradeableBeacon deployed to:", address(beacon));
        console.log("MachineStationFactory proxy deployed to:", address(factoryProxy));
        console.log("Admin address:", adminAddress);
        console.log("Station Manager address:", stationManager);

        return factory;
    }
}
