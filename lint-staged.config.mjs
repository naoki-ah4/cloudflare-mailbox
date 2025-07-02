export default {
    "*.{ts,tsx}": [
        "eslint --fix",
        "prettier --write"
    ],
    "*.{js,jsx,mjs,cjs,json,html,css,scss,md}": [
        "prettier --write"
    ]
}