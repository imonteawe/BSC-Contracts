var token_balance;
var token_supply;

async function update_balances() {
    var default_account = (await web3provider.eth.getAccounts())[0];
    if (default_account) {
        for (let i = 0; i < N_COINS; i++)
            wallet_balances[i] = parseInt(await coins[i].methods.balanceOf(default_account).call());
        token_balance = parseInt(await swap_token.methods.balanceOf(default_account).call());
    }
    else {
        token_balance = 0;
    }
    for (let i = 0; i < N_COINS; i++) {
        balances[i] = parseInt(await swap.methods.balances(i).call());
        if(!default_account) balances[i] = 0
    }
    token_supply = parseInt(await swap_token.methods.totalSupply().call());
}

function handle_change_amounts(i) {
return async function() {
        var real_values = [...$("[id^=currency_]")].map((x,i) => +($(x).val()));
        var values = [...$("[id^=currency_]")].map((x,i) => $(x).val() / c_rates[i])
        values = values.map(v=>cBN(Math.floor(v).toString()).toFixed(0,1))
        let show_nobalance = false;
        let show_nobalance_i = 0;
        for(let i = 0; i < N_COINS; i++) {
            let coin_balance = parseInt(await swap.methods.balances(i).call()) * c_rates[i];
            if(coin_balance < real_values[i]) {
                show_nobalance |= true;
                show_nobalance_i = i;
            }
            else
                show_nobalance |= false;
        }
        if(show_nobalance) {
            $("#nobalance-warning").show();
            $("#nobalance-warning span").text($("label[for='currency_"+show_nobalance_i+"']").text());
            return;
        }
        else {
            $("#nobalance-warning").hide();
        }
        try {
            var availableAmount =  await swap.methods.calc_token_amount(values, false).call()
            availableAmount = availableAmount / (1 - fee * N_COINS / (4 * (N_COINS - 1)))
            var default_account = (await web3provider.eth.getAccounts())[0];
            var maxAvailableAmount = parseInt(await swap_token.methods.balanceOf(default_account).call());

            if(availableAmount > maxAvailableAmount) {
                $('[id^=currency_]').css('background-color', 'gray');
            }
            else {
                $('[id^=currency_]').css('background-color', 'blue');
            }
            await calc_slippage(false);

            var share = $('#liquidity-share');
            share.val('---');
            share.css('background-color', '#707070');
            share.css('color', '#d0d0d0');
        }
        catch(err) {
            console.error(err)
            $('[id^=currency_]').css('background-color', 'gray');
        }
    }
}

function handle_change_share() {
    var share = $('#liquidity-share');
    var val = share.val();

    share.css('background-color', 'blue');
    share.css('color', 'aqua');
    if (val == '---') {
        share.val('0.0');
        val = 0;
    }
    else if ((val > 100) | (val < 0))
        share.css('background-color', 'gray');

    for (let i = 0; i < N_COINS; i++) {
        var cur = $('#currency_' + i);
        if ((val >=0) & (val <= 100)) {
            cur.val((val / 100 * balances[i] * c_rates[i] * token_balance / token_supply).toFixed(2))
        }
        else
            cur.val('0.00');
        cur.css('background-color', '#707070');
        cur.css('color', '#d0d0d0');
    }
}

async function handle_remove_liquidity() {
    try {    
        var share = $('#liquidity-share');
        var share_val = share.val();
        var amounts = $("[id^=currency_]").toArray().map(x => $(x).val());
        var min_amounts = []
        for (let i = 0; i < N_COINS; i++) {
            amounts[i] = cBN(Math.floor(amounts[i] / c_rates[i]).toString()).toFixed(0,1); // -> c-tokens
            min_amounts[i] = cBN(0.97).multipliedBy(share_val/100).multipliedBy(cBN(balances[i]))
            .multipliedBy(cBN(token_balance))
            .div(cBN(token_supply))
            .toFixed(0,1)
        }
        var txhash;
        var default_account = (await web3provider.eth.getAccounts())[0];
        if (share_val == '---') {
            var token_amount = await swap.methods.calc_token_amount(amounts, false).call();
            token_amount = cBN(Math.floor(token_amount * 1.01).toString()).toFixed(0,1)
            await swap.methods.remove_liquidity_imbalance(amounts, token_amount).send({from: default_account, gas: 1000000});
        }
        else {
            var amount = cBN(Math.floor(share_val / 100 * token_balance).toString()).toFixed(0,1);
            if (share_val == 100)
                amount = await swap_token.methods.balanceOf(default_account).call();
            await swap.methods.remove_liquidity(amount, min_amounts).send({from: default_account, gas: 600000});
        }
        if(share_val != '---') {
            for (let i = 0; i < N_COINS; i++) {
                handle_change_amounts(i)();
            }
        }
        await update_balances();
        update_fee_info();
    }
    catch(err) {
        console.error(err)
    }
}

function init_ui() {
    for (let i = 0; i < N_COINS; i++) {
        $('#currency_' + i).focus(handle_change_amounts(i));
        $('#currency_' + i).on('input', debounced(100, handle_change_amounts(i)));
    }
    $('#liquidity-share').focus(handle_change_share);
    $('#liquidity-share').on('input', handle_change_share);

    handle_change_share();
    update_fee_info();

    $("#remove-liquidity").click(handle_remove_liquidity);
}

window.addEventListener('DOMContentLoaded', async () => {
    try {
        await init();
        await update_rates();
        await update_balances();
        init_ui();
    }
    catch(err) {
        console.error(err);
        if(err.reason == 'cancelDialog') {
            const web3 = new newWeb3(infura_url);
            window.web3provider = web3;
            window.web3 = web3

            await init_contracts();
            await update_rates();
            await update_balances();
            init_ui();
        }
    }
});
