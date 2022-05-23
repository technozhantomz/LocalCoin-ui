# ioxbank Instant Swap Service
A Bridge Instant Swap Service is responsible for moving cryptocurrencies between BitShares and other Blockchains. You can easily identify those cryptocurrencies supported by ioxbank, they are prefixed with **IOB.** and marked as featured in dashboard page.

## Help Docs
[https://support.ioxbank.com/docs](https://support.ioxbank.com/docs)

## Support
- [Live Support](https://t.me/ioxbank)
- [Open a Ticket](https://support.ioxbank.com)

## IOB.XRP features
- Instant swap
- Min. amount: 20 XRP
- No KYC
- No limits
- Low market fees
- Low withdraw fee

### Gateway Transparency Information
- [XRPL Balance](https://livenet.xrpl.org/accounts/rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y)
- [IOB.XRP Current supply](/asset/IOB.XRP)

### Deposit to your BitShares wallet from your XRP wallet
- **XRP Destination address:** rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y
- **XRP Destination tag (ONLY NUMBERS):** BitShares user ID (without 1.2.)

### Withdraw from your BitShares wallet to your XRP wallet
Send your **IOB.XRP** assets to BitShares Blockchain Account [ioxbank-gateway](/account/ioxbank-gateway) and use one of the following memo options in your memo, you need to replace *xrp-address* with your xrp destination address and *tag-number* with your destination tag number, in case you have no tag number you can send memo without including a tag with just xrp:*xrp-address* in your memo and replace *xrp-address* with your xrp destination address:
- xrp:**xrp-address**:tag:**tag-number**:**memo**
- xrp:**xrp-address**:tag:**tag-number**
- xrp:**xrp-address**

### Withdraw Examples: 
- If you want to withdraw your XRPs to your XRP address **rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y** and your tag is **485738**; the memo that should be included with the send operation of **IOB.XRP** should be **xrp:rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y:tag:485738** or **xrp:rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y:tag:485738:thanks for the wonderful bridge**

- If you want to withdraw your XRPs to your XRP address **rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y** in case you own the private keys of the XRP address; you don't need to include a tag, the memo that should be included with the send operation of **IOB.XRP** should be **xrp:rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**
