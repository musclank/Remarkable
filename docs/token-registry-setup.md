# Remarkable Token Registry (Cloudflare D1)

The Token Registry stores tokens launched through Remarkable and prioritizes them in the Base Token Explorer's **New** tab. Live price/volume values continue to come from Clanker and DexScreener.

## Cloudflare setup

1. In Cloudflare Dashboard, open **Workers & Pages → D1 SQL Database** and create a database named `remarkable-token-registry`.
2. Open the database's **Console** and run the SQL in `migrations/0001_token_registry.sql`.
3. Open **Workers & Pages → remarkable-1ry → Settings → Functions → D1 database bindings** (wording may vary).
4. Add a binding with variable name **DB** and select `remarkable-token-registry`.
5. Redeploy the latest Pages deployment.

The API is `/api/tokens/registry`. GET returns saved tokens; POST registers a confirmed Base token. The server checks the successful Base receipt, deployed contract code, and that the token address emitted logs in that transaction before saving. It does not hold or request wallet private keys.

If D1 is not bound, the launch itself still succeeds; the success screen explains that registry storage is pending. After binding, new launches will register automatically.
