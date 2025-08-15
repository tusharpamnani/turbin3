/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/vault.json`.
 */
export type Vault = {
    "address": "88xpy9nAw9KhW2Zp5DyE5qpohxWniHLDX8Sv2E1cBcnM",
    "metadata": {
      "address": "88xpy9nAw9KhW2Zp5DyE5qpohxWniHLDX8Sv2E1cBcnM",
      "name": "vault",
      "version": "0.1.0",
      "spec": "0.1.0",
      "description": "Created with Anchor"
    },
    "instructions": [
      {
        "name": "close",
        "discriminator": [
          98,
          165,
          201,
          177,
          108,
          65,
          206,
          96
        ],
        "accounts": [
          {
            "name": "user",
            "writable": true,
            "signer": true
          },
          {
            "name": "vaultState",
            "writable": true,
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    118,
                    97,
                    117,
                    108,
                    116,
                    95,
                    115,
                    116,
                    97,
                    116,
                    101
                  ]
                },
                {
                  "kind": "account",
                  "path": "user"
                }
              ]
            }
          },
          {
            "name": "vault",
            "writable": true,
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    118,
                    97,
                    117,
                    108,
                    116
                  ]
                },
                {
                  "kind": "account",
                  "path": "vaultState"
                }
              ]
            }
          },
          {
            "name": "systemProgram",
            "address": "11111111111111111111111111111111"
          }
        ],
        "args": []
      },
      {
        "name": "deposit",
        "discriminator": [
          242,
          35,
          198,
          137,
          82,
          225,
          242,
          182
        ],
        "accounts": [
          {
            "name": "user",
            "writable": true,
            "signer": true
          },
          {
            "name": "vault",
            "writable": true,
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    118,
                    97,
                    117,
                    108,
                    116
                  ]
                },
                {
                  "kind": "account",
                  "path": "vaultState"
                }
              ]
            }
          },
          {
            "name": "vaultState",
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    118,
                    97,
                    117,
                    108,
                    116,
                    95,
                    115,
                    116,
                    97,
                    116,
                    101
                  ]
                },
                {
                  "kind": "account",
                  "path": "user"
                }
              ]
            }
          },
          {
            "name": "systemProgram",
            "address": "11111111111111111111111111111111"
          }
        ],
        "args": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "orderId",
            "type": "u64"
          }
        ]
      },
      {
        "name": "initialize",
        "discriminator": [
          175,
          175,
          109,
          31,
          13,
          152,
          155,
          237
        ],
        "accounts": [
          {
            "name": "user",
            "writable": true,
            "signer": true
          },
          {
            "name": "vaultState",
            "writable": true,
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    118,
                    97,
                    117,
                    108,
                    116,
                    95,
                    115,
                    116,
                    97,
                    116,
                    101
                  ]
                },
                {
                  "kind": "account",
                  "path": "user"
                }
              ]
            }
          },
          {
            "name": "vault",
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    118,
                    97,
                    117,
                    108,
                    116
                  ]
                },
                {
                  "kind": "account",
                  "path": "vaultState"
                }
              ]
            }
          },
          {
            "name": "systemProgram",
            "address": "11111111111111111111111111111111"
          }
        ],
        "args": []
      },
      {
        "name": "withdraw",
        "discriminator": [
          183,
          18,
          70,
          156,
          148,
          109,
          161,
          34
        ],
        "accounts": [
          {
            "name": "user",
            "writable": true,
            "signer": true
          },
          {
            "name": "vaultState",
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    118,
                    97,
                    117,
                    108,
                    116,
                    95,
                    115,
                    116,
                    97,
                    116,
                    101
                  ]
                },
                {
                  "kind": "account",
                  "path": "user"
                }
              ]
            }
          },
          {
            "name": "vault",
            "writable": true,
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    118,
                    97,
                    117,
                    108,
                    116
                  ]
                },
                {
                  "kind": "account",
                  "path": "vaultState"
                }
              ]
            }
          },
          {
            "name": "systemProgram",
            "address": "11111111111111111111111111111111"
          }
        ],
        "args": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "orderId",
            "type": "u64"
          }
        ]
      }
    ],
    "accounts": [
      {
        "name": "vaultState",
        "discriminator": [
          228,
          196,
          82,
          165,
          98,
          210,
          235,
          152
        ]
      }
    ],
    "events": [
      {
        "name": "depositEvent",
        "discriminator": [
          120,
          248,
          61,
          83,
          31,
          142,
          107,
          144
        ]
      },
      {
        "name": "withdrawEvent",
        "discriminator": [
          22,
          9,
          133,
          26,
          160,
          44,
          71,
          192
        ]
      }
    ],
    "errors": [
      {
        "code": 6000,
        "name": "programPaused",
        "msg": "Program is currently paused"
      },
      {
        "code": 6001,
        "name": "amountTooSmall",
        "msg": "Deposit amount is below minimum allowed"
      },
      {
        "code": 6002,
        "name": "unauthorizedAccess",
        "msg": "Only the authority can perform this action"
      },
      {
        "code": 6003,
        "name": "insufficientFunds",
        "msg": "Insufficient funds in vault"
      },
      {
        "code": 6004,
        "name": "unauthorizedWithdrawal",
        "msg": "Withdrawal not authorized"
      }
    ],
    "types": [
      {
        "name": "depositEvent",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "user",
              "type": "pubkey"
            },
            {
              "name": "orderId",
              "type": "u64"
            },
            {
              "name": "amount",
              "type": "u64"
            }
          ]
        }
      },
      {
        "name": "vaultState",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "authority",
              "type": "pubkey"
            },
            {
              "name": "vaultBump",
              "type": "u8"
            },
            {
              "name": "stateBump",
              "type": "u8"
            }
          ]
        }
      },
      {
        "name": "withdrawEvent",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "user",
              "type": "pubkey"
            },
            {
              "name": "orderId",
              "type": "u64"
            },
            {
              "name": "withdrawAmount",
              "type": "u64"
            }
          ]
        }
      }
    ],
    "constants": [
      {
        "name": "seed",
        "type": "string",
        "value": "\"anchor\""
      }
    ]
  };