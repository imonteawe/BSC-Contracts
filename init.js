let cancelablePromise;
$(document).click(function(event) {
  $target = $(event.target);
  if(!$target.closest('.web3modal-provider-wrapper').length &&
  $('.web3modal-provider-wrapper').is(":visible") && cancelablePromise && (!window.web3provider || (window.web3provider && window.web3provider.version != '1.0.0-beta.34'))) {
    cancelablePromise.cancel('cancelDialog');
  }
});
async function init() {
    init_menu();

    const providerOptions = {};

    const web3Modal = new Web3Modal.default({
      network: "mainnet", // optional
      cacheProvider: true, // optional
      providerOptions // required
    });

    window.web3Modal = web3Modal

    const provider = web3Modal.connect();
    cancelablePromise = makeCancelable(provider);
    return cancelablePromise.then(async (provider) => {
        provider.on && provider.on("chainChanged", (chainId) => {
            console.log(chainId, "CHAIN")
        });

        provider.on && provider.on("accountsChanged", (accounts) => {
            console.log(accounts)
            location.reload()
        })

        const web3 = new newWeb3(provider);
        window.web3provider = web3;
        window.web3 = web3

    /*    if (window.ethereum)
        {
            window.web3 = new Web3(ethereum);
            await ethereum.enable();
        }
        else
            window.web3 = new Web3(infura_url);*/
        await init_contracts();
    })

}
