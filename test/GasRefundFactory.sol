// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test} from "forge-std/Test.sol";
import {Errors} from "../src/libs/Errors.sol";
import {GasRefundFactory} from "../src/gas-refund/GasRefundFactory.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Constants} from "../src/libs/Constants.sol";

contract GasRefundFactoryTest is Test {
    GasRefundFactory public gasRefundFactory;
    GasRefundFactory public implementation;

    address public admin;
    uint256 public adminPrivateKey;

    address public manager;
    uint256 public managerPrivateKey;

    function setUp() public {
        gasRefundFactory = new GasRefundFactory();

        adminPrivateKey = 0x1;
        admin = vm.addr(adminPrivateKey);

        managerPrivateKey = 0x2;
        manager = vm.addr(managerPrivateKey);

        uint256 refundAmount = 100 ether;

        implementation = new GasRefundFactory();

        bytes memory initData = abi.encodeWithSelector(
            GasRefundFactory.initialize.selector,
            admin,
            manager,
            refundAmount
        );

        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        gasRefundFactory = GasRefundFactory(payable(address(proxy)));
    }

    function testInitialize() public view {
        uint256 refundAmount = 100 ether;

        assertEq(gasRefundFactory.hasRole(gasRefundFactory.DEFAULT_ADMIN_ROLE(), admin), true);
        assertEq(gasRefundFactory.hasRole(gasRefundFactory.MANAGER_ROLE(), manager), true);
        assertEq(gasRefundFactory.configs(gasRefundFactory.TX_FEE_REFUND_AMOUNT_KEY()), refundAmount);
        assertEq(gasRefundFactory.configs(gasRefundFactory.IS_REFUND_ENABLED_KEY()), 1);
        assertEq(gasRefundFactory.configs(gasRefundFactory.CHECK_REFUND_MIN_BALANCE_KEY()), 0);
    }

    function testCannotReinitialize() public {
        vm.expectRevert(Errors.InvalidInitialization.selector);
        gasRefundFactory.initialize(admin, manager, 100 ether);
    }

    function testInitializeWithZeroAddress() public {
        GasRefundFactory newFactory = new GasRefundFactory();

        bytes memory initData = abi.encodeWithSelector(
            GasRefundFactory.initialize.selector,
            address(0),
            manager,
            100 ether
        );

        vm.expectRevert(Errors.ZeroAddress.selector);
        new ERC1967Proxy(address(newFactory), initData);
    }
}
