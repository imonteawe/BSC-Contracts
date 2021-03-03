var from_currency;
var to_currency;

async function set_from_amount(i) {
    var default_account = (await web3provider.eth.getAccounts())[0];
    var el = $('#from_currency');
    let balance = await underlying_coins[i].methods.balanceOf(default_account).call();
    let amount = Math.floor(
            100 * parseFloat(balance) / coin_precisions[i]
        ) / 100
    if (el.val() == '' || el.val() == 0) {
        if(!default_account) amount = 0
        $('#from_currency').val(amount.toFixed(2));
    }
    $('fieldset:first .maxbalance span').text(amount.toFixed(2))
}

async function set_max_balance() {
    var default_account = (await web3provider.eth.getAccounts())[0];
    let balance = await underlying_coins[from_currency].methods.balanceOf(default_account).call();
    let amount = Math.floor(
            100 * parseFloat(balance) / coin_precisions[from_currency]
        ) / 100
    $('#from_currency').val(amount.toFixed(2));
    await set_to_amount();
}

async function highlight_input() {
    var default_account = (await web3provider.eth.getAccounts())[0];
    var el = $('#from_currency');
    var balance = parseFloat(await underlying_coins[from_currency].methods.balanceOf(default_account).call()) / coin_precisions[from_currency];
    if (el.val() > balance)
        el.css('background-color', 'gray')
    else
        el.css('background-color', 'gray');
}

let promise = makeCancelable(Promise.resolve());
async function set_to_amount() {
    promise.cancel();
    promise = setAmountPromise()
        .then(([dy, dy_, dx_]) => {
            $('#to_currency').val(dy);
            var exchange_rate = (dy_ / dx_).toFixed(4);
            if(exchange_rate <= 0.98) $("#to_currency").css('background-color', 'gray')
            else $("#to_currency").css('background-color', '#505070')
            if(isNaN(exchange_rate)) exchange_rate = "Not available"
            $('#exchange-rate').text(exchange_rate);
            $('#from_currency').prop('disabled', false);
        })
        .catch(err => {
            console.error(err);
            $('#from_currency').prop('disabled', true);

        })
        .finally(() => {
            highlight_input();
        })
    promise = makeCancelable(promise)
}

function setAmountPromise() {
    let promise = new Promise(async (resolve, reject) => {
        var i = from_currency;
        var j = to_currency;
        var b = parseInt(await swap.methods.balances(i).call()) * c_rates[i];
        if (b >= 0.001) {
            // In c-units
            var dx_ = $('#from_currency').val();
            var dx = cBN(Math.round(dx_ * coin_precisions[i]).toString()).toFixed(0,1);
            var dy_ = parseInt(await swap.methods.get_dy_underlying(i, j, dx).call()) / coin_precisions[j];
            var dy = dy_.toFixed(2);
            resolve([dy, dy_, dx_])
        }
        else {
            reject()
        }
    })
    return makeCancelable(promise);
}

async function from_cur_handler() {
    from_currency = $('input[type=radio][name=from_cur]:checked').val();
    to_currency = $('input[type=radio][name=to_cur]:checked').val();
    var default_account = (await web3provider.eth.getAccounts())[0];

    await set_from_amount(from_currency);
    if (to_currency == from_currency) {
        if (from_currency == 0) {
            to_currency = 1;
        } else {
            to_currency = 0;
        }
        $("#to_cur_" + to_currency).prop('checked', true);
    }
    await set_to_amount();
}

async function to_cur_handler() {
    from_currency = $('input[type=radio][name=from_cur]:checked').val();
    to_currency = $('input[type=radio][name=to_cur]:checked').val();
    if (to_currency == from_currency) {
        if (to_currency == 0) {
            from_currency = 1;
        } else {
            from_currency = 0;
        }
        $("#from_cur_" + from_currency).prop('checked', true);
        await set_from_amount(from_currency);
    }
    await set_to_amount();
}

async function handle_trade() {
    var default_account = (await web3provider.eth.getAccounts())[0];
    var i = from_currency;
    var j = to_currency;
    var b = parseInt(await swap.methods.balances(i).call()) / c_rates[i];
    var max_slippage = $("#max_slippage > input[type='radio']:checked").val();
    if(max_slippage == '-') {
        max_slippage = $("#custom_slippage_input").val() / 100;
    }
    if (b >= 0.001) {
        var dx = Math.floor($('#from_currency').val() * coin_precisions[i]);
        var min_dy = Math.floor($('#to_currency').val() * (1-max_slippage) * coin_precisions[j]);
        dx = cBN(dx.toString()).toFixed(0,1);
        await ensure_underlying_allowance(i, max_allowance);
        min_dy = cBN(min_dy.toString()).toFixed(0,1);
        await swap.methods.exchange_underlying(i, j, dx, min_dy).send({
            from: default_account,
            gas: 1600000});

        await update_rates();
        update_fee_info();
        from_cur_handler();
    }
}

function change_max_slippage() {
    if(this.id == 'custom_slippage')
        $('#custom_slippage_input').prop('disabled', false)
    else
        $('#custom_slippage_input').prop('disabled', true)
}

async function init_ui() {
    $('input[type=radio][name=from_cur]').change(from_cur_handler);
    $('input[type=radio][name=to_cur]').change(to_cur_handler);

    $("#from_cur_0").attr('checked', true);
    $("#to_cur_1").attr('checked', true);

    $('#from_currency').on('input', debounced(100, set_to_amount));
    $('#from_currency').click(function() {this.select()});
    $('fieldset:first .maxbalance').click(set_max_balance);
    $("#max_slippage input[type='radio']").click(change_max_slippage);

    $("#trade").click(handle_trade);

    await update_rates();
    update_fee_info();
    from_cur_handler();
    $("#from_currency").on("input", highlight_input);
}

window.addEventListener('load', async () => {
    try {
        await init();

        await init_ui();

        $("#from_currency").attr('disabled', false)

    }
    catch(err) {
        console.error(err)
        if(err.reason == 'cancelDialog') {
            const web3 = new newWeb3(infura_url);
            window.web3provider = web3;
            window.web3 = web3

            await init_contracts();

            await init_ui();
            $("#from_currency").attr('disabled', false)
        }
    }
});
