import json

addr = open("node1/address").read().strip()
addr_no_0x = addr[2:] if addr.startswith("0x") else addr

genesis = {
    "config": {
        "chainId": 1337,
        "londonBlock": 0,
        "clique": {
            "blockperiodseconds": 2,
            "epochlength": 30000
        }
    },

    # no 0x
    "nonce": "0x0",
    "timestamp": "0x58ee40ba",
    "extraData": "0x" + ("0" * 64) + addr_no_0x + ("0" * 130), 
    "gasLimit": "0x1fffffffffffff",
    "difficulty": "0x1",
    "mixHash": "0x" + ("0" * 64),
    "coinbase": "0x0000000000000000000000000000000000000000",
    "alloc": {
        addr: {
            "balance": "0x3635C9ADC5DEA00000" 
        }
    }
}

with open("genesis.json", "w") as f:
    json.dump(genesis, f, indent=2)

print("Created genesis.json")
print("Signer address:", addr)
print("Signer address without 0x:", addr_no_0x)