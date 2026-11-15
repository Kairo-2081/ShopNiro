# Screen-reader checklist (about 30 minutes)

Status: **not run by anyone.** The automated checks (axe scans, keyboard coverage, a Lighthouse accessibility gate) catch
missing labels and contrast. They cannot tell whether the page makes sense when read aloud. Only a person with a screen
reader can.

## Before you start

- Pick one reader for each platform you can: **TalkBack** (Android, Settings, Accessibility), **VoiceOver** (iPhone,
  Settings, Accessibility), or **NVDA** (free, Windows, with Firefox or Chrome). One platform is much better than none.
- Test **staging**, not production, and sign in only with test accounts.
- Turn the screen off or close your eyes for the first pass. If you can see the screen you will skip over problems.
- Know the basics: TalkBack, swipe right/left to move and double-tap to activate; VoiceOver the same with swipe and
  double-tap; NVDA, Tab and arrow keys, and `H` for the next heading.

## How to mark each line

**Pass** if you could do it with the reader alone and what you heard was clear. **Fail** if you got stuck, heard nothing,
heard something misleading, or needed to look. Write what you heard on a fail.

## 1. First load

- [ ] The page announces a title or heading that says it is ShopNiro.
- [ ] The first focus stop is a **Skip to content** link, and activating it jumps to the main content.
- [ ] Headings give a sensible outline (move heading to heading).
- [ ] The language is announced correctly; switching to Bangla changes the voice.
- [ ] The decorative orbit globe is skipped or described briefly, not read as noise.

## 2. Sign in

- [ ] Open the sign-in dialog. Focus moves into it and the dialog is announced.
- [ ] Each field is announced with a name (email, password) and its type.
- [ ] Enter a wrong password. The error is **announced** without you hunting for it.
- [ ] Sign in with a test account. You hear that you are signed in or arrive somewhere clearly named.
- [ ] Escape closes the dialog and focus returns to the control that opened it.

## 3. Find a product

- [ ] Reach the product list. You hear how many products there are or can tell where the list starts.
- [ ] Each card reads as one item: name, price, seller, and a rating if shown, not a pile of fragments.
- [ ] Search for a product. You hear the result count or a clear empty state.
- [ ] Filtering by category announces the change.
- [ ] Open a product. The detail dialog is announced, and the image has useful alt text or is marked decorative.

## 4. Add to cart

- [ ] The Add to cart button says which product it adds, not just "Add".
- [ ] After activating it you hear a confirmation (a toast announcement), and the cart count is announced.
- [ ] Open the cart. Quantities, line prices and the total are all readable, and the quantity buttons are named.
- [ ] Remove an item. You hear that it was removed.

## 5. Check out

- [ ] Every checkout field has a name; required fields say so.
- [ ] Submit with an empty field. The error is announced and focus goes to the problem.
- [ ] The delivery address, payment method and order total are all announced before you confirm.
- [ ] Choosing cash on delivery and confirming gives a clear confirmation with an order number.
- [ ] Do **not** use a real card. Online payments run in sandbox on staging; the gateway page itself is out of scope.

## 6. Orders

- [ ] Open your orders. Each order reads as one item with its status in words (not just a colour).

## Record

| Field | Value |
| --- | --- |
| Date | |
| Reader and version | |
| Device and browser | |
| Tester | |
| Sections passed (of 6) | |
| Blocking failures | |
| Other failures, with what was heard | |

A **blocking failure** is anything that stops a screen-reader user finishing sign in, finding a product, adding to cart, or
checking out. Those have to be fixed before launch. File each failure as an issue with the section number and what you heard.
