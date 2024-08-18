import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import {ethers} from "ethers";

const bot = new Telegraf(process.env.ROTTED_TG_BOT || '');

const rotToken = "0xD04785C4d8195e4A54d9dEc3a9043872875ae9E2"
const rotWethPool = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const providerUrl = "https://eth.llamarpc.com";
const contractsWhereTokensAreStuck = [
    "0x5A265315520696299fa1EcE0701c3a1BA961b888",
    "0x2dCCDB493827E15a5dC8f8b72147E6c4A5620857",
    "0xE488C45ADEa8d83E25EbC548F711CeF799E5A24E",
    "0xb0B948f321Ddc5E1f138EDb158504fFAc375F21F",
    "0xC6fBD546a505262f59B711cC4530c4711c364fAB",
    "0x39a13a5541112D24830BDE4b8CE581b7416c5239",
    "0x7d2C778A923648A7288e38554b9433BE8d51B57E",
];

const provider = new ethers.JsonRpcProvider(providerUrl);

const abiErc20 = [
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address owner) view returns (uint256)"
];

const abiOracle = [
    "function getPrice(address token) view returns (uint256)",
]

const oracleAddy = "0x48dc32eca58106f06b41de514f29780ffa59c279"
const maggotAddy = "0x163c754eF4D9C03Fc7Fa9cf6Dd43bFc760E6Ce89"

const rotContract = new ethers.Contract(rotToken, abiErc20, provider);
const maggotContract = new ethers.Contract(maggotAddy, abiErc20, provider);
const oracleContract = new ethers.Contract(oracleAddy, abiOracle, provider);


const TOKEN_DECIMALS = 18;

const lastHour = 300;
const lastDay = 7200;
const lastMonth = 216000;

(async () => {


    bot.command('price', async (ctx) => {
        console.log("/price")
        const currentBlock = await provider.getBlockNumber()
        const currentPrice = await getPriceAt(currentBlock)
        const nLastHour = await getPriceAt(currentBlock - lastHour)
        const nLastDay = await getPriceAt(currentBlock - lastDay)
        const nLastMonth = await getPriceAt(currentBlock - lastMonth)
        const str = `<code>Now       : ${formatLargeNumber(currentPrice, 10)}$ </code>
<code>Last hour : ${formatLargeNumber(nLastHour, 10)}$ = </code><b>${formatterPercentage.format((currentPrice - nLastHour ) / currentPrice)}</b>
<code>Last day  : ${formatLargeNumber(nLastDay, 10)}$ = </code><b>${formatterPercentage.format((currentPrice - nLastDay) / currentPrice)}</b>
<code>Last month: ${formatLargeNumber(nLastMonth, 10)}$ = </code><b>${formatterPercentage.format((currentPrice - nLastMonth) / currentPrice)}</b>`
        ctx.replyWithHTML(str)
    });
    bot.command('mcap', async (ctx) => {
        console.log("/mcap")
        const supply = await getTotalSupply(rotContract)
        const currentBlock = await provider.getBlockNumber()
        const price = await getPriceAt(currentBlock)
        ctx.replyWithHTML(`Current mcap: ${formatLargeNumber(price * supply, 0)}$`)
    } );
    bot.command('deflation', async (ctx) => {
        console.log("/deflation")
        const currentBlock = await provider.getBlockNumber()
        const now = await getTotalSupply(rotContract)
        const nLastHour = await getTotalSupplyAt(rotContract, currentBlock - lastHour)
        const nLastDay = await getTotalSupplyAt(rotContract, currentBlock - lastDay)
        const nLastMonth = await getTotalSupplyAt(rotContract, currentBlock - lastMonth)
        const str = `TOKEN'S BURNING 🥵: 
Current supply: ${formatLargeNumber(now)}
Last hour: ${formatLargeNumber(now - nLastHour)} = <b>${formatterPercentage.format((nLastHour - now) / nLastHour)}</b>
Last day : ${formatLargeNumber(now - nLastDay)} = <b>${formatterPercentage.format((nLastDay - now ) / nLastDay)}</b>
Last month: ${formatLargeNumber(now - nLastMonth)} = <b>${formatterPercentage.format((nLastMonth - now) / nLastMonth)}</b>
`
        ctx.replyWithHTML(str)

    });
    bot.command('stuck', async (ctx) => {
        console.log("/stuck")
        const totalSupply = await getTotalSupply(maggotContract)
        const r = await Promise.all(contractsWhereTokensAreStuck.map(a => getBalance(maggotContract, a)))
        const total = Number(r.reduce((a, b) => a + b) / BigInt(1e18));
        const percent = total / totalSupply
        ctx.reply(`Total maggot stuck: ${formatLargeNumber(total, 0)} MAGGOT (${formatterPercentage.format(percent)})`)
    });

    bot.launch({
        dropPendingUpdates: true
    });

    console.log("Bot STARTED")
})()

async function getTotalSupplyAt(contract: any, block: number) {
    try {
        const blockTag: ethers.BlockTag = block
        // @ts-ignore
        const totalSupply = await contract["totalSupply"].staticCall(...[], {blockTag});

        return Number((totalSupply as bigint) / BigInt(1e18));
    } catch (error) {
        console.error("Error fetching total supply:", error);
        throw error;
    }
}

async function getPriceAt(block: number) {
    try {
        const blockTag: ethers.BlockTag = block
        // @ts-ignore
        const totalSupply = await oracleContract["getPrice"].staticCall(...[rotToken], {blockTag});

        return Number((totalSupply as bigint)) / 1e18;
    } catch (error) {
        console.error("Error fetching total supply:", error);
        throw error;
    }
}

async function getTotalSupply(contract: any) {
    try {
        // @ts-ignore
        const totalSupply = await contract.totalSupply();

        return Number((totalSupply as bigint) / BigInt(1e18));
    } catch (error) {
        console.error("Error fetching total supply:", error);
        throw error;
    }
}

async function getBalance(contract: any, holderAddress: string) {
    try {
        // @ts-ignore
        const balance = await maggotContract.balanceOf(holderAddress);

        return balance as bigint
    } catch (error) {
        console.error("Error fetching balance:", error);
        throw error;
    }
}


function formatLargeNumber(num: number, decimalPlaces: number = 2): string {
    const isNegative = num < 0;
    const absNum = Math.abs(num);

    const [integerPart, decimalPart] = absNum.toString().split('.');

    const formattedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    let formattedDecimalPart = '';
    if (decimalPlaces > 0) {
        formattedDecimalPart = '.' + (decimalPart || '0').padEnd(decimalPlaces, '0').slice(0, decimalPlaces);
    }

    return (isNegative ? '-' : '') + formattedIntegerPart + formattedDecimalPart;
}


export const formatterPercentage = new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});