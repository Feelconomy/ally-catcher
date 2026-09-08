# Screen Asset Map
## Cozy Pixel Claw / Arcade Mobile Web

This file maps which assets appear on which screens for a claw-machine mobile web product.
It is optimized for playful consumer UX, mobile readability, and strong reward feedback.

---

# 1. Core screen principles
Every screen should combine these 4 layers:

1. Functional layer
- buttons
- cards
- tabs
- machine states
- currency indicators

2. Domain layer
- claw machines
- plush prizes
- tokens / tickets
- controls
- result states

3. Reward layer
- confetti
- rarity badges
- claimable chests
- stamps
- win effects

4. Atmosphere layer
- arcade signage
- bulb lights
- ribbons
- playful backdrops
- plush cameos

---

# 2. Global shell
## Shared shell assets
- top title / page ribbon
- wallet strip (coins, tickets, gems)
- bottom navigation plaque
- toast / popup frames
- small event notice slot

## Bottom navigation
Tabs:
- lobby
- machines
- collection
- missions
- my page

Optional additional tabs:
- shop
- event

---

# 3. Screen-by-screen map

## 3.1 Login screen
Purpose: introduce the product with strong brand warmth.

Required assets:
- logo or game title marquee
- hero machine / plush illustration
- ID input frame
- password input frame
- guest login button
- primary login button
- optional social login buttons
- small sign-up / find account links

Optional assets:
- guide mascot cameo
- floating plush heads
- blinking star lights
- coin / ticket decorative strip

Recommended intensity: Medium to Full
Recommended theme: Candy or Peach

---

## 3.2 Intro / tutorial screen
Required assets:
- guide mascot or plush tutorial card
- step cards explaining play flow
- mini machine diagram
- joystick / drop button explanation sprites
- CTA button

---

## 3.3 Lobby / home screen
Purpose: the main arcade hub.

Required assets:
- featured machine banner
- wallet summary card
- notice ticker or event ribbon
- machine category tabs
- machine cards or carousel
- quick links to missions, attendance, collection, shop
- recent winner strip or jackpot spotlight

Asset zones:
### Hero banner
- spotlighted claw machine
- event badge
- CTA play button
- optional bulb lights or confetti edge

### Wallet bar
- coin icon + amount
- ticket icon + amount
- gem icon + amount
- recharge/add button

### Machine category row
- plush
- capsule
- event
- beginner
- popular
- limited

### Machine grid/list
Each card contains:
- machine thumbnail
- prize preview
- difficulty / status badge
- cost per play
- new / limited / popular ribbon
- enter/play CTA

### Quick shortcut row
- collection
- missions
- attendance
- ranking
- coupons

---

## 3.4 Machine browse screen
Required assets:
- machine filters
- sorting controls
- machine cards
- category ribbon
- availability states

Optional assets:
- live popularity flame badge
- featured prize chip

---

## 3.5 Machine detail screen
Purpose: preview one machine before play.

Required assets:
- large machine artwork
- prize preview carousel
- play cost card
- status badges
- machine description / tips panel
- “enter game” CTA
- favorite button
- prize rarity labels

Optional assets:
- beginner tip mascot
- recent winners panel
- odds / simple difficulty indicator if product supports it

---

## 3.6 Play screen
Purpose: active game interaction.

Required assets:
- machine viewport frame
- chamber with arranged prizes
- claw arm / chain / claw states
- joystick control
- drop button
- timer bar
- current currency / remaining plays card
- exit / help buttons

Optional assets:
- camera angle toggle
- speed / accessibility control
- subtle cheering plush icon

Rules:
- controls must be very readable
- reward FX must not block the chamber view
- latency / interaction clarity has priority over decoration

Recommended intensity: Medium to Full
Recommended theme: Sky / Candy / Ocean accents

---

## 3.7 Result screen
Purpose: emotional feedback.

Required assets:
- win / lose / near-miss result frame
- captured prize art or miss icon
- confetti or soft failure puff effect
- next actions: replay, go to collection, share
- reward info

Variants:
### Success
- bright confetti
- burst star
- rarity ribbon
- “new” or duplicate badge

### Near miss
- encouraging wording area
- tiny bounce/sweat effect
- retry CTA emphasized

### Fail
- clean reset CTA
- soft puff or sleepy plush reaction

Recommended theme: Honey reward accents + active play palette

---

## 3.8 Collection / inventory screen
Purpose: display owned prizes.

Required assets:
- collection header ribbon
- shelf or glass cabinet layout
- filter chips by type / rarity / series
- prize tiles/cards
- owned/new/duplicate/limited badges
- sort controls
- item detail drawer or modal

Optional assets:
- series progress meter
- showcase favorite slot
- gift/send action

---

## 3.9 Prize detail screen
Required assets:
- large prize sprite
- rarity / series badge
- flavor text panel
- ownership count
- related machine info
- share or gift buttons

Optional assets:
- rotate / alt pose preview if supported
- series collection neighbors

---

## 3.10 Missions screen
Purpose: keep retention and goals clear.

Required assets:
- mission board frame
- daily / weekly / special tabs
- mission rows/cards
- claim buttons
- progress bars
- milestone chest strip

Optional assets:
- mascot cheering panel
- combo streak badge

---

## 3.11 Attendance screen
Required assets:
- attendance calendar / stamp card
- today highlight
- claim reward button
- streak meter
- preview of upcoming rewards

Optional assets:
- premium attendance track
- lucky day event marker

---

## 3.12 Shop / recharge screen
Purpose: monetize clearly without breaking tone.

Required assets:
- wallet summary
- currency pack cards
- special offer ribbon
- coupon entry field
- purchase buttons
- bonus items icons

Optional assets:
- plush gift-box decoration
- first purchase badge

Recommended intensity: Medium
Recommended theme: Honey + Candy accents

---

## 3.13 Coupons / gift box screen
Required assets:
- coupon card list
- gift box cards
- expiry chips
- claim/use button
- empty-state scene when none

---

## 3.14 Ranking / leaderboard screen
Required assets:
- ranking podium art
- leaderboard rows
- crown icons
- user highlight row
- period tabs (daily/weekly/event)

Optional assets:
- top winner plush
- confetti side accents

---

## 3.15 Event page
Required assets:
- event banner hero
- limited machine cards
- event missions
- countdown plaque
- event reward strip
- CTA buttons

Optional assets:
- seasonal decorations
- limited prize series showcase

---

## 3.16 My page / profile screen
Required assets:
- profile plaque
- avatar or favorite plush display
- wallet summary
- stats: total plays, wins, collection count, streak
- recent prizes
- settings shortcuts

Optional assets:
- favorite machine card
- cabinet preview

---

## 3.17 Settings / support screen
Required assets:
- toggles
- sound / vibration options
- account / logout button
- FAQ / support links
- legal links

Intensity: Light to Medium
Decoration should be lighter than game screens.

---

## 3.18 Empty states
Every major feature should have a themed empty state.

Examples:
- no prizes owned -> empty display shelf with one spotlight
- no missions claimable -> tidy mission board with sleeping stamp
- no coupons -> unopened gift envelope box
- no event participation -> quiet event tent with invite ribbon

---

# 4. Priority screens to polish first
Tier 1:
- login
- lobby
- machine detail
- play screen
- result screen
- collection

Tier 2:
- missions
- attendance
- shop
- my page
- event

Tier 3:
- ranking
- settings
- coupon inbox

