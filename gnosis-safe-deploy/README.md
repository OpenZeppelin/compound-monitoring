# Forta Deployment from a Gnosis Safe

## Deploy a Gnosis Safe to Polygon

Create a `config.json` file (see the `config.json.example` file for reference), specifying the addresses of the owners, the number of signatures necessary for a proposal to be approved, and the
version of the Gnosis Safe to deploy (valid versions are 1.0.0, 1.1.0, 1.1.1, 1.2.0, and 1.3.0).
```json
{
    "safeAccountConfig": {
        "owners": [
            "0xFIRSTADDRESS",
            "0xSECONDADDRESS",
            ...
            "0xLASTADDRESS"
        ],
        "threshold": numberOfSignaturesNeeded
    },
    "safeVersion": "gnosisSafeVersionNumber"
}
```

Also, in the `.env` file, you will need to add the following entries to be able to interact with a Polygon JSON-RPC provider
```bash
POLYGON_ENDPOINT="https://your.polygon.endpoint/with/api/key"
DEPLOYER_PRIVATE_KEY="0xPRIVATEKEYFORPOLYGONACCOUNTTODEPLOYSAFE"
```

Make sure that the Deployer's account has MATIC to be able to deploy the contract.

Then run:
`npm run deploy`

This should deploy a Gnosis Safe Proxy contract to Polygon, display the address of the contract, and save the address to a JSON
format file called `deployments.json` in the main directory of the repository.

## Create a Forta Bot


## Propose Forta Bot Deployment

Ensure that you have updated the Dockerfile to appropriately pull in all dependencies needed by the Forta Bot code.

Then run:
`npm run propose`


## Approve Proposed Forta Bot Deployment 


