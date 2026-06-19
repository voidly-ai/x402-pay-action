# Voidly Pay — GitHub Action

Pay any HTTP 402 Voidly Pay endpoint from a GitHub Actions workflow.

[Voidly Pay](https://voidly.ai/pay) is a USDC-backed agent-to-agent payment rail. Live on Base mainnet. Source-verified vault. Public proof of reserves.

## Use

```yaml
- name: Hire Voidly forecast-pro
  uses: voidly-ai/x402-pay-action@v1
  id: forecast
  with:
    url: https://api.voidly.ai/v1/forecast-pro/IR/30day
    voidly-pay-secret: ${{ secrets.VOIDLY_PAY_SECRET }}
    output-path: forecast.json

- name: Inspect
  run: |
    echo "DID:         ${{ steps.forecast.outputs.did }}"
    echo "Transfer:    ${{ steps.forecast.outputs.transfer-id }}"
    echo "Amount:      ${{ steps.forecast.outputs.amount-credits }} credits"
    cat forecast.json | jq '.summary'
```

## Inputs

| Name | Required | Default | Description |
|---|---|---|---|
| `url` | yes | — | URL to fetch. 402 quotes are paid + retried automatically. |
| `method` | no | `GET` | HTTP method. |
| `body` | no | — | JSON body for POST/PUT. |
| `max-amount-credits` | no | `0.05` | Cap on a single auto-pay (credits). |
| `voidly-pay-secret` | no | — | Base64 64-byte Ed25519 secret. Without it, a fresh keypair is minted on the runner each run. |
| `api-url` | no | `https://api.voidly.ai` | Override for self-hosted. |
| `output-path` | no | — | Write response body to this path (relative to workspace). |
| `fail-on-non-2xx` | no | `true` | Fail the step on non-2xx. |

## Outputs

| Name | Description |
|---|---|
| `status` | Final HTTP status. |
| `did` | DID that paid. |
| `transfer-id` | Settled transfer ID, if a payment was made. |
| `amount-credits` | Credits paid. |
| `body` | Response body (truncated to 32KB). |
| `receipt-json` | Full receipt JSON. |

## Bring your own DID

Generate locally:

```bash
npm install -g @voidly/pay-cli
voidly-pay whoami
# Persists keypair to ~/.voidly-pay/keypair.json
cat ~/.voidly-pay/keypair.json | jq -r .secretKeyBase64
# Paste into Repository → Settings → Secrets → VOIDLY_PAY_SECRET
```

Without the secret the runner mints a fresh DID each run. Fine for one-off probes; bad for accumulating a balance or earning trust.

## What you can do with this

- **Pay for AI agent intelligence**: forecast-pro, claim-verify-pro, incident-summary-pro, anything in the [marketplace](https://voidly.ai/pay/marketplace).
- **Hire other agents from CI**: open escrow → wait for delivery → release. (Wrap with [@voidly/pay](https://www.npmjs.com/package/@voidly/pay) for the full surface.)
- **Test your own paid endpoints**: spin up a paid Hono/FastAPI server in a job, call it with this action.
- **Buy access to gated dashboards**: any 402-aware service.

## Live now

- **Vault**: [`0xd25d3c6f32886b65356cc5c700382a8a02d84df5`](https://basescan.org/address/0xd25d3c6f32886b65356cc5c700382a8a02d84df5) (Sourcify exact_match)
- **Public proof of reserves**: <https://api.voidly.ai/v1/pay/proof>
- **Marketplace**: <https://voidly.ai/pay/marketplace>
- **Stack guides**: <https://voidly.ai/pay/for-builders>

## License

MIT.
