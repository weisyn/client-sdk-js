# GitHub 仓库元数据

本文档记录 GitHub 仓库的 Description 和 Topics 信息，用于在 GitHub 仓库设置中配置。

## Description（仓库描述）

```
WES Client SDK for JavaScript/TypeScript - 用于链外应用开发的 JavaScript/TypeScript 客户端工具包，提供 Token、Staking、Market、Governance、Resource 等业务服务
```

## Topics（标签，用空格分隔）

```
javascript typescript nodejs sdk resource market websocket dapp blockchain grpc json-rpc client-sdk wallet token governance wes staking utxo blockchain-sdk browser frontend typescript-sdk web3
```

## 设置方法

### 方法 1：通过 GitHub Web 界面

1. 访问仓库设置页面：https://github.com/weisyn/client-sdk-js/settings
2. 在 "General" 部分找到 "Description" 字段，填入上述描述
3. 在 "Topics" 部分添加上述所有标签

### 方法 2：通过 GitHub CLI

```bash
# 设置描述
gh repo edit weisyn/client-sdk-js --description "WES Client SDK for JavaScript/TypeScript - 用于链外应用开发的 JavaScript/TypeScript 客户端工具包，提供 Token、Staking、Market、Governance、Resource 等业务服务"

# 设置 Topics
gh repo edit weisyn/client-sdk-js --add-topic javascript,typescript,nodejs,sdk,resource,market,websocket,dapp,blockchain,grpc,json-rpc,client-sdk,wallet,token,governance,wes,staking,utxo,blockchain-sdk,browser,frontend,typescript-sdk,web3
```

### 方法 3：通过 GitHub API

```bash
# 设置描述和 Topics
curl -X PATCH \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/weisyn/client-sdk-js \
  -d '{
    "description": "WES Client SDK for JavaScript/TypeScript - 用于链外应用开发的 JavaScript/TypeScript 客户端工具包，提供 Token、Staking、Market、Governance、Resource 等业务服务",
    "topics": ["javascript", "typescript", "nodejs", "sdk", "resource", "market", "websocket", "dapp", "blockchain", "grpc", "json-rpc", "client-sdk", "wallet", "token", "governance", "wes", "staking", "utxo", "blockchain-sdk", "browser", "frontend", "typescript-sdk", "web3"]
  }'
```

## 参考

- client-sdk-go 的 Description: "WES Client SDK for Go - 用于链外应用开发的 Go 语言客户端工具包，提供 Token、Staking、Market、Governance、Resource 等业务服务"
- client-sdk-go 的 Topics: go, golang, sdk, resource, market, websocket, dapp, blockchain, grpc, json-rpc, client-sdk, wallet, token, governance, wes, staking, utxo, blockchain-sdk

