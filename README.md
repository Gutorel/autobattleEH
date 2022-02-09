# autobattle-EpicHero



## Getting started

1. Go to [https://nodejs.org/en/download/] and install nodeJS LTS (16.xx)
2. Download this repo in zip
3. Put your private key from metamask to the .env file
    1. account info
    2. export you privatekey
    3. enter you password
    4. paste the priavte key in the .env file
4. run "npm i"
5. wait the installation of all dependencies
6. configure your battleHero file
6. run "node ./App/battlebot.js"

## Configure battles
All battles are configured in the battleHero file
Each battle are set with:
```JSON
  {
    "_comment" : "any comment, battle x",
    "heroId": [1, 2, 3],
    "poolId": 0,
    "pass": false
  }
```
`"_comment"`: (text) can put anything here, it's just a memo

`"pass"`: (bool) must be true if you don't want to run this battle (for exemple you already use your hero)

`"poolId"`: (int) between 3 and 14

- 3: demi medium 1
- 4: demi medium 2
- 5: demi medium 3
- 6: demi large 1
- 7: demi large 2
- 8: demi large 3
- 9: genesis small 1
- 10: genesis small 2
- 11: genesis small 3
- 12: genesis medium 1
- 13: genesis medium 2
- 14: genesis medium 3

`"heroId"`: (int) the number of your hero