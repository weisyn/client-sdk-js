# 测试 Fixtures

**版本**: 1.0  


---

## 📋 概述

本目录包含集成测试使用的测试数据和期望结果，部分 fixtures 与 Go SDK 共享，确保跨 SDK 一致性。

---

## 📁 目录结构

```
fixtures/
├── README.md              # 本文档
├── accounts.json          # 预置账户配置
├── contracts/             # 预置合约
│   ├── token.json        # Token 合约配置
│   └── staking.json      # Staking 合约配置
└── expectations/         # 期望状态/错误码（与 Go SDK 共享）
    ├── token/
    │   └── basic-transfer.json
    ├── staking/
    │   └── basic-stake.json
    └── error-codes.json
```

---

## 📝 文件说明

### accounts.json

预置账户配置，包含测试使用的账户信息：

```json
{
  "miner": {
    "address": "0x...",
    "privateKey": "0x...",
    "description": "出块账户，初始大余额"
  },
  "userA": {
    "address": "0x...",
    "privateKey": "0x...",
    "description": "普通用户 A，有初始 WES"
  },
  "userB": {
    "address": "0x...",
    "privateKey": "0x...",
    "description": "普通用户 B"
  }
}
```

> **注意**：实际私钥不应提交到仓库，应通过环境变量注入。

---

### contracts/

预置合约配置，包含测试使用的合约信息：

#### token.json

```json
{
  "address": "0x...",
  "abi": [...],
  "bytecode": "0x...",
  "description": "标准 Token 合约"
}
```

#### staking.json

```json
{
  "address": "0x...",
  "abi": [...],
  "bytecode": "0x...",
  "description": "Staking 合约"
}
```

---

### expectations/

期望状态和错误码，与 Go SDK 共享，确保跨 SDK 一致性。

#### token/basic-transfer.json

基础转账的期望结果：

```json
{
  "scenario": "basic-transfer",
  "description": "USER_A 向 USER_B 转账 100 WES",
  "expected": {
    "fromBalanceBefore": 1000000,
    "toBalanceBefore": 0,
    "transferAmount": 100000,
    "fromBalanceAfter": 900000,
    "toBalanceAfter": 100000,
    "transactionStatus": "confirmed",
    "events": [
      {
        "type": "Transfer",
        "from": "USER_A",
        "to": "USER_B",
        "amount": 100000
      }
    ]
  }
}
```

#### staking/basic-stake.json

基础质押的期望结果：

```json
{
  "scenario": "basic-stake",
  "description": "USER_A 质押 1000 WES",
  "expected": {
    "balanceBefore": 1000000,
    "stakeAmount": 1000000,
    "balanceAfter": 0,
    "stakedAmount": 1000000,
    "transactionStatus": "confirmed"
  }
}
```

#### error-codes.json

错误码映射表：

```json
{
  "methodNotFound": {
    "code": "METHOD_NOT_FOUND",
    "layer": "SDK_HTTP_ERROR",
    "httpStatus": 404
  },
  "invalidParams": {
    "code": "INVALID_PARAMS",
    "layer": "SDK_HTTP_ERROR",
    "httpStatus": 400
  }
}
```

---

## 🔄 跨 SDK 共享

### 共享策略

1. **期望结果文件**：`expectations/` 目录下的 JSON 文件与 Go SDK 共享
2. **错误码映射**：`error-codes.json` 与 Go SDK 共享
3. **账户配置**：不共享（各 SDK 使用自己的测试账户）

### 使用方式

#### Go SDK

```go
import "encoding/json"
import "os"

func loadExpectation(scenario string) (*Expectation, error) {
    data, err := os.ReadFile(fmt.Sprintf("fixtures/expectations/%s.json", scenario))
    // ...
}
```

#### JS SDK

```typescript
import * as fs from 'fs';

function loadExpectation(scenario: string): Expectation {
    const data = fs.readFileSync(`fixtures/expectations/${scenario}.json`, 'utf-8');
    // ...
}
```

---

## 🚀 使用示例

### 在测试中使用 Fixtures

```typescript
describe('Token Flow', () => {
  it('should match expected results', async () => {
    // 加载期望结果
    const expectation = loadExpectation('token/basic-transfer');
    
    // 执行测试
    // ...
    
    // 验证结果
    expect(actualBalance).toBe(expectation.expected.fromBalanceAfter);
  });
});
```

---

## 🔗 相关文档

- [集成测试设计文档](../DESIGN.md)
- [集成测试快速开始指南](../README.md)

---



