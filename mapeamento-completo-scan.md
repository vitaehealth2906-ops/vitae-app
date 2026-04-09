# MAPEAMENTO COMPLETO — Sistema de Scan de Medicamentos vita id

Data: 09/04/2026
Modo: HM-init — mapeamento total antes de qualquer planejamento
Total de itens mapeados: 1041
Total de categorias: 15

---



Here is the complete map. I've gone through every category you listed, validated each item, and added every additional item that a world-class CTO with pharmacy/health/IoT experience would flag. Nothing is solved â€” this is purely the territory.

---

# COMPLETE MAP â€” MEDICATION SCANNING SYSTEM

---

## CATEGORY A â€” THE CAMERA ITSELF

### A1 â€” Camera Hardware Scenarios
- Back camera (single lens â€” most common on budget phones)
- Back camera (dual lens â€” wide + ultrawide)
- Back camera (triple lens â€” wide + ultrawide + telephoto)
- Back camera (quad lens â€” wide + ultrawide + telephoto + macro/depth)
- Front camera (selfie â€” patient accidentally opens front-facing)
- Front camera (wide-angle distortion â€” barrel effect on barcodes)
- Macro lens auto-switching (some phones switch to macro when close, causing refocus lag)
- Auto-focus capable vs fixed-focus (some ultra-budget phones have no autofocus)
- Autofocus hunting (camera repeatedly tries to focus and fails on shiny packaging)
- Minimum focus distance per device (some can't focus closer than 10cm)
- Digital zoom vs optical zoom (digital zoom degrades barcode readability)
- Camera sensor resolution differences (2MP front vs 48MP back â€” processing implications)
- Camera startup time (cold start vs warm start â€” can be 0.5s to 3s)
- Dirty lens (fingerprints, grease, pocket lint, cracked glass over lens)
- Phone case blocking lens partially
- Camera lens fogging (humid bathroom, coming from AC to hot outdoors)
- Scratched lens (old phone, dropped)
- Screen protector/film extending over camera area on some budget phones

### A2 â€” Lighting Conditions
- Bright direct sunlight (overexposure, washout)
- Bright indirect sunlight (ideal but rare)
- Indoor fluorescent lighting (flickering on camera â€” rolling shutter banding)
- Indoor LED lighting (usually fine but can have PWM flicker)
- Indoor incandescent/warm lighting (yellow cast)
- Dim indoor lighting (noise, grain, slow shutter)
- Complete darkness (zero light â€” camera sees nothing)
- Backlighting (light source behind the medication box)
- Mixed lighting (half shadow, half light on the barcode)
- Colored lighting (RGB LEDs in some rooms, tinted windows)
- Hospital/clinical lighting (very bright, cold white, reflective surfaces)
- Car interior (dashboard light, sun visor shadows, moving shadows from outside)
- Phone flashlight as primary light source (harsh single-point light, creates glare on glossy packaging)
- Flashlight reflection on glossy/laminated packaging (specular highlight directly on barcode)
- Sunset/golden hour through window (extreme warm cast)
- Night mode auto-activating (some phones trigger long exposure, causes motion blur)
- HDR auto-activating (processing delay, may not help barcodes)

### A3 â€” Angle and Distance
- Phone perfectly parallel to barcode (ideal)
- Phone tilted 15-30 degrees (still readable usually)
- Phone tilted 45+ degrees (perspective distortion, bars merge)
- Phone perpendicular to barcode (extreme angle, unreadable)
- Distance: too close (< 5cm, can't focus)
- Distance: optimal (8-20cm for most phones)
- Distance: too far (> 40cm, barcode bars too thin to resolve)
- Distance: varies by barcode size (tiny EAN-8 vs large EAN-13)
- Barcode on curved surface (tube, bottle) â€” curvature distorts bars
- Barcode on recessed area of packaging (shadow in the recess)
- Barcode on the fold/crease of the box
- Barcode partially hidden by a flap or tab
- Patient's hand/fingers partially covering the barcode while holding the box

### A4 â€” Phone Position/Orientation
- Portrait (vertical) â€” most natural phone holding
- Landscape (horizontal) â€” barcode may be horizontal
- Phone tilted diagonally
- Phone upside down (camera at bottom â€” some patients hold it wrong)
- Phone flat on table pointing down at medication on the table (awkward angle)
- Phone propped against something (unstable, might fall)
- Patient holding both phone AND medication (one hand each â€” shaky)
- Patient resting phone on the medication box (too close, can't focus)

### A5 â€” Camera Permission States
- Permission never requested yet (first time)
- Permission granted
- Permission denied once (can re-request on some browsers)
- Permission denied permanently (must go to OS settings)
- Permission granted but later revoked in settings
- Permission granted but camera is physically broken
- Permission granted but another app is using the camera (video call, etc.)
- Permission granted but browser tab was backgrounded and camera released
- Permission granted but phone is in Do Not Disturb / Focus Mode (should not affect, but test)
- Permission dialog interrupted (phone call comes in during dialog)
- Permission dialog displayed but patient doesn't understand it (language, confusion)
- iOS: permission is per-website (vitae.app gets its own permission)
- Android: permission is per-browser (Chrome gets camera permission for all sites)
- In-app browser: permission depends on parent app granting camera to its webview
- Browser permission vs OS permission (both must be granted)

### A6 â€” Browser-Specific Behaviors
- Safari on iPhone (WebKit-only, getUserMedia supported since iOS 11)
- Safari on iPad (same engine, but different screen ratios)
- Chrome on Android (most common, Chromium engine)
- Firefox on Android (GeckoView, different getUserMedia behavior)
- Samsung Internet (Chromium-based, but Samsung adds features/quirks)
- Opera on Android (Chromium-based)
- Brave on Android (Chromium-based, may block certain APIs by default)
- UC Browser (popular in some demographics, non-standard behavior)
- Mi Browser / Xiaomi default browser (custom WebView)
- Huawei Browser (no Google services, HMS-based)
- WhatsApp in-app browser (WebView, camera access often blocked or limited)
- Instagram in-app browser (WebView, same issues)
- Facebook in-app browser (WebView, same issues)
- Telegram in-app browser (WebView)
- LinkedIn in-app browser (WebView)
- Gmail in-app browser (WebView on Android, Safari on iOS)
- Google app browser (WebView)
- Twitter/X in-app browser
- TikTok in-app browser
- Chrome on iOS (uses WebKit, NOT Chromium â€” same as Safari under the hood)
- Firefox on iOS (uses WebKit â€” same as Safari under the hood)
- Edge on iOS and Android
- PWA (installed to home screen) â€” different permission and fullscreen behavior
- Desktop browser on phone (user set "Request Desktop Site" â€” breaks mobile camera UI)
- Private/incognito mode (permissions may not persist, may be more restrictive)

### A7 â€” iOS Version Differences
- iOS 14 and below (older getUserMedia constraints, limited camera selection)
- iOS 15 (WebRTC improvements, but still WebKit-only)
- iOS 16 (Screen orientation API changes, some facingMode improvements)
- iOS 17 (new privacy prompts, camera permission changes)
- iOS 18 (latest â€” need to track any breaking changes)
- iOS Safari: no Barcode Detection API (must use JS library like ZXing or QuaggaJS)
- iOS Safari: torch/flashlight API not supported (can't turn on flash programmatically)
- iOS Safari: zoom API not supported or limited
- iOS Safari: getUserMedia resolution constraints behave differently than Chrome
- iOS Safari: camera preview orientation can be wrong if not handled
- iOS Safari: WKWebView (in-app) vs full Safari have different API support
- iOS: PWA fullscreen behavior different from browser
- iOS: interruptions (phone call, FaceTime, Siri) pause camera stream
- iOS: app switcher blurs the page (privacy) â€” camera stops
- iOS: low power mode may throttle camera/processing

### A8 â€” Android Version Differences
- Android 7-8 (old WebView, getUserMedia may not work well)
- Android 9-10 (better camera API support, but varies by manufacturer)
- Android 11 (scoped storage changes, one-time permissions introduced)
- Android 12 (camera/mic indicators in status bar, approximate permissions)
- Android 13 (photo picker, notification permissions â€” less relevant but context)
- Android 14 (latest â€” track changes)
- Android: manufacturer skin differences (Samsung OneUI, Xiaomi MIUI, Huawei EMUI, Oppo ColorOS, Motorola stock-ish)
- Android: WebView version varies (System WebView vs Chrome-based)
- Android: some devices have Barcode Detection API (Shape Detection API)
- Android: torch/flashlight API works on most devices via MediaStreamTrack
- Android: facingMode: "environment" may not select the right camera on multi-camera devices
- Android: Samsung devices sometimes have camera API quirks
- Android: Xiaomi devices sometimes block camera in WebViews by default
- Android: permission model varies slightly by manufacturer (some add extra prompts)
- Android Go edition (low RAM, limited camera processing)
- Android: background restrictions may kill the browser tab while scanning

### A9 â€” Tablets
- iPad (all sizes: mini, regular, Air, Pro)
- iPad: camera position is different (landscape default, camera on short edge or long edge depending on model)
- iPad: patient may hold it in landscape (camera viewfinder orientation changes)
- iPad: larger screen means larger viewfinder â€” different UX
- Android tablets (Samsung Tab, Lenovo, Amazon Fire)
- Amazon Fire tablets (FireOS, limited browser, Silk browser)
- Foldable phones (Samsung Fold, Flip) â€” screen ratio changes, camera position unusual
- Foldable: when folded vs unfolded, camera behavior changes
- Chrome OS tablets (rare but exist)

---

## CATEGORY B â€” THE BARCODE ITSELF

### B1 â€” Barcode Types on Brazilian Medications
- EAN-13 (the standard â€” 13 digits, starts with 789 or 790 for Brazil)
- EAN-8 (shorter, 8 digits â€” rare on medications, sometimes on very small packages)
- GS1 DataBar (used on some pharmaceutical products, encodes more data)
- GS1-128 (used in hospital/logistics, encodes lot, expiry, serial)
- GS1 DataMatrix (2D code â€” ANVISA mandates for rastreabilidade since RDC 157/2017)
- QR Code (some manufacturers add QR linking to bula digital or product page)
- Internal pharmacy barcode (pharmacy prints their own label with their internal code)
- Nota Fiscal barcode (if the box has a danfe/NF sticker)
- IFA code (Identificador de Fabricante â€” ANVISA's pharma identifier)
- GTIN (Global Trade Item Number â€” the number encoded in the EAN-13)
- DUM (DenominaÃ§Ã£o Ãšnica do Medicamento) â€” not a barcode but associated data
- MS Registry number (Registro MS/ANVISA) â€” sometimes encoded in DataMatrix
- Lot number barcode (separate barcode just for lot tracking)
- Serial number barcode (SNGPC serialization)

### B2 â€” Barcode Location on Packaging
- Bottom of the cartonada box (most common for EAN-13)
- Side panel of the box
- Back panel of the box
- On a flap or tuck of the box
- On the blister pack itself (usually no barcode, sometimes printed)
- On the bottle label (wrapped label â€” barcode curves with the bottle)
- On the tube crimp (the flat sealed end of a tube)
- On the tube label (again, curved surface)
- On the sachet (individual dose sachet â€” small, low print quality)
- On the ampoule label (tiny, cylindrical â€” extremely hard to scan)
- On the aerosol can label
- On the pen injector label
- On the prefilled syringe label
- On the eye drop bottle (very small bottle, curved)
- On the nasal spray bottle
- DataMatrix: often on the side panel near the lot/expiry
- DataMatrix: sometimes laser-etched (low contrast)

### B3 â€” What Makes a Barcode Unreadable
- Physical damage (torn, scratched, water-damaged)
- Sticker placed over the barcode (pharmacy price sticker, promotional sticker)
- Transparent sticker partially covering (security seal)
- Printing defect (bars too thick, too thin, bleeding ink)
- Low contrast (dark barcode on dark background, or light barcode on light background)
- Faded barcode (old medication, sun-bleached packaging)
- Glossy/reflective packaging causing glare on the barcode
- Metallic/holographic packaging (some premium medications)
- Barcode printed on curved surface (distortion)
- Barcode printed on textured/embossed surface
- Barcode printed on transparent/semi-transparent packaging (background shows through)
- Barcode too small (below minimum module width for camera resolution)
- Barcode in "quiet zone" violation (not enough white space around the barcode)
- Barcode partially cut off by packaging fold or manufacturing error
- Barcode printed in color (red barcodes on white â€” some scanners can't read)
- Ink smudge across bars
- Condensation/moisture on the packaging surface
- Patient drew on the barcode (marking their medication with pen)

### B4 â€” Pharmacy Price Stickers
- Price sticker has its own barcode (pharmacy internal EAN or Code-128)
- Price sticker placed directly over the medication EAN barcode
- Price sticker placed next to the medication barcode (two barcodes side by side)
- Price sticker barcode typically shorter or different format
- Multiple pharmacy stickers (if medication was transferred between pharmacies)
- Sticker from FarmÃ¡cia Popular (government program â€” specific format)
- Sticker from PBM (Pharmacy Benefit Manager) programs
- Sticker partially peeled (patient tried to remove it)
- Sticker with QR code from pharmacy app/loyalty program

### B5 â€” Multiple Barcodes on Same Package
- EAN-13 (commercial) + DataMatrix (ANVISA tracking) â€” most common combo
- EAN-13 + pharmacy sticker barcode
- EAN-13 + QR code (manufacturer marketing)
- EAN-13 + GS1-128 (hospital/wholesale channel)
- Display box barcode vs individual unit barcode (different GTINs)
- How to tell which barcode is the medication identifier
- Scanner reads the wrong one â€” how does the app know?
- Patient presents the side with the wrong barcode first
- Barcodes on different faces of the box (have to flip to find the right one)

### B6 â€” Barcode Orientation
- Horizontal barcode (bars are vertical, most common orientation)
- Vertical barcode (bars are horizontal â€” "ladder" orientation)
- Barcode rotated 45 degrees (rare but exists on some packaging)
- DataMatrix has no orientation issue (2D, reads in any rotation)
- QR code has no orientation issue (2D)
- Phone orientation vs barcode orientation mismatch (patient holds phone portrait, barcode is horizontal)

### B7 â€” Scanning Distance and Size
- Minimum focus distance of the camera (typically 7-10cm)
- Minimum barcode module width resolvable at a given distance
- EAN-13 standard size: 37.29mm wide â€” readable from ~15cm
- EAN-13 reduced size (80%): ~30mm â€” readable from ~12cm
- EAN-13 minimum allowed size (80%): harder for budget phone cameras
- EAN-8 is smaller overall â€” must be closer
- DataMatrix can be as small as 2mm x 2mm (laser-etched) â€” nearly impossible for phone camera
- DataMatrix at 10mm x 10mm â€” readable with good camera at ~10cm
- Maximum useful distance: ~30-40cm for standard EAN-13 (beyond this, bars blend)
- Practical sweet spot: 10-20cm for most phone cameras
- Low-end phone cameras: narrower working distance range
- High-resolution cameras: slightly more forgiving at distance

---

## CATEGORY C â€” THE MEDICATION PACKAGING

### C1 â€” Every Type of Brazilian Medication Packaging
- Caixa cartonada (folding carton box â€” the most common, contains blister inside)
- Blister solto (blister pack without its box â€” patient discarded the box)
- Frasco (bottle â€” glass or plastic, for liquids, pills, capsules)
- Frasco conta-gotas (dropper bottle â€” for liquid oral medications)
- Ampola (ampoule â€” glass, for injectable)
- Frasco-ampola (vial â€” for injectable, with rubber stopper)
- SachÃª (sachet â€” single-dose powder or granule)
- Tubo / Bisnaga (tube â€” for creams, ointments, gels)
- Aerosol / Spray (pressurized canister â€” for asthma inhalers, topical sprays)
- Caneta injetora (pen injector â€” insulin pens, GLP-1 agonists)
- Seringa preenchida (prefilled syringe â€” vaccines, anticoagulants)
- ColÃ­rio (eye drops â€” small bottle with dropper tip)
- Spray nasal (nasal spray â€” pump bottle)
- Adesivo transdÃ©rmico (transdermal patch â€” in a pouch/sachet)
- SupositÃ³rio (suppository â€” usually in blister or foil wrap)
- Ã“vulo vaginal (vaginal ovule â€” similar to suppository packaging)
- Envelope (paper envelope for powdered medications â€” common for compounded)
- Pote (jar/pot â€” for large quantity creams, powders)
- Bolsa (bag â€” for IV solutions)
- Dispositivo inalatÃ³rio (inhaler device â€” Diskus, Turbuhaler, Respimat, etc.)
- CÃ¡psula de inalaÃ§Ã£o (inhalation capsule â€” used with a device like Aerolizer)
- Kit (combination package â€” syringe + vial + needles together)
- Flaconete (small plastic ampoule â€” single dose, like sodium chloride)

### C2 â€” Information Visible on Each Type
- Caixa cartonada: nome comercial, princÃ­pio ativo, concentraÃ§Ã£o, forma farmacÃªutica, quantidade, fabricante, lote, validade, registro MS, EAN-13, DataMatrix, tarja (cor)
- Blister solto: usually only nome comercial, concentraÃ§Ã£o, lote, validade (minimal info)
- Frasco: label has nome, concentraÃ§Ã£o, volume, lote, validade, sometimes partial EAN
- Ampola: printed directly on glass â€” very small text, often just nome + concentraÃ§Ã£o + lote + validade
- SachÃª: nome, concentraÃ§Ã£o, single-dose info, lote, validade
- Tubo: label or printing on tube body â€” nome, concentraÃ§Ã£o, weight/volume
- Aerosol: label on canister â€” nome, concentraÃ§Ã£o, doses remaining (sometimes)
- Caneta injetora: label on pen body â€” nome, concentraÃ§Ã£o, volume, lot, expiry
- ColÃ­rio: very small label â€” nome, concentraÃ§Ã£o, volume
- Tarja: vermelha (red stripe â€” requires prescription), preta (black stripe â€” controlled), sem tarja (OTC)

### C3 â€” Medication Without Original Box
- Patient discarded the box, only has blister
- Patient discarded the box, only has bottle
- Patient has loose pills/capsules in a generic container
- Patient has the box but it's been opened and is squished/damaged
- Patient cut the blister (only has partial strip)
- Patient has the medication but the label fell off the bottle
- Patient has a photo of the box they took before discarding it
- Patient has the bula (package insert) but not the box
- Compounded medication (manipulado) â€” comes in generic bottles with pharmacy labels

### C4 â€” Damaged Packaging
- Box crushed/deformed (barcode on a crumpled surface)
- Box wet/stained (barcode obscured)
- Box torn (barcode partially missing)
- Box sun-faded (text and barcode faded)
- Label peeling off bottle
- Label wrinkled/bubbled on bottle
- Tube crimped end damaged (where barcode usually is)
- Blister punctured (pills popped out, package deformed)
- Box opened and re-taped (some info hidden under tape)

### C5 â€” Medications in Pillboxes (Porta-comprimidos)
- No packaging at all â€” just loose pills
- Patient might not remember which pill is which
- No barcode, no label, no identifying info on the pillbox
- Color/shape/size/imprint of the pill is the only identifier
- Pill identification by image (totally different problem from barcode scanning)
- Half-pills (patient cuts pills in half per doctor's instructions)
- Crushed pills (for patients who can't swallow)

### C6 â€” Medications in Pharmacy Bags
- White plastic bag with pharmacy branding â€” no useful info on the bag
- Stapled bag with Nota Fiscal attached â€” NF has medication names but in fiscal format
- Multiple medications in the same bag
- Cupom fiscal (receipt) inside the bag â€” has medication names but abbreviated

### C7 â€” Display Boxes and Multi-Unit Packaging
- Caixa display contains multiple individual boxes (e.g., 12 units for pharmacy shelf)
- Display box has its own EAN (different from individual unit EAN)
- Hospital unit-dose packaging (individual doses with their own barcodes)
- Sample packaging (amostra grÃ¡tis) â€” may have different or no barcode
- Sample packaging is explicitly marked "Amostra GrÃ¡tis â€” Venda Proibida"

---

## CATEGORY D â€” THE PATIENT

### D1 â€” Age Range
- Teenager (13-17) managing their own medication (e.g., acne, ADHD)
- Young adult (18-30) â€” usually tech-literate, may not take medication seriously
- Adult (30-50) â€” starting chronic medications, busy lifestyle
- Middle-aged (50-65) â€” multiple medications, reading glasses needed
- Elderly (65-80) â€” multiple comorbidities, polypharmacy, declining vision/dexterity
- Very elderly (80-90+) â€” may need caregiver assistance, cognitive decline
- Pediatric patients (parent/caregiver scanning for a child's medication)

### D2 â€” Tech Literacy
- Never used a smartphone (phone was a gift, someone else set it up)
- Uses phone only for WhatsApp and calls
- Can navigate apps but doesn't understand permissions/settings
- Comfortable with apps but not cameras/QR codes
- Moderate user (uses banking apps, food delivery)
- Power user (understands all phone features)
- Uses assistive technology (screen reader, magnifier)
- Thinks tapping anywhere might "break something"
- Doesn't understand the concept of "allowing camera access"
- Doesn't know difference between app, website, and browser

### D3 â€” Physical Limitations
- Trembling hands (Parkinson's, essential tremor, anxiety, medication side effect)
- Low vision (uncorrected, age-related, diabetic retinopathy, cataracts, macular degeneration)
- Blind or near-blind (uses screen reader)
- One hand occupied (holding the medication, using a cane, carrying something)
- One arm/hand amputated or paralyzed
- Wheelchair user (different posture, may have medication on a table or lap)
- Lying in bed (holding phone above face, medication on the side table)
- Sitting in a car (confined space, moving)
- Arthritis in hands (can't grip phone tightly, can't tap small targets)
- Neuropathy (reduced finger sensitivity, imprecise touches)
- Patient on oxygen (nasal cannula/mask â€” not directly relevant but indicates fragility)
- Patient with IV in arm (limited hand/arm mobility)

### D4 â€” Cognitive Limitations
- Mild confusion (normal aging)
- Dementia (early to moderate â€” may not understand the app's purpose)
- Brain fog (from medication side effects, fibromyalgia, long COVID)
- Difficulty reading (functional illiteracy is significant in Brazil)
- Difficulty understanding medical terms
- Difficulty understanding technology instructions
- Short attention span (gives up quickly)
- Memory issues (forgets what they just did in the app)
- Dyslexia
- ASD/ADHD (may need very clear, sequential instructions)

### D5 â€” Emotional State
- Anxious (just received a new diagnosis)
- Rushing (pharmacy is closing, needs to set up quickly)
- Scared (first time using a "health app")
- Frustrated (already tried and failed)
- In pain (wants to take the medication NOW, not "set up an app")
- Overwhelmed (10 medications to scan, feeling defeated)
- Skeptical (doesn't believe the app will help)
- Grieving (medication for someone else who is seriously ill)
- Angry (forced to use app by doctor/family member)
- Apathetic (doesn't care about medication adherence)
- Depressed (low motivation, low energy)

### D6 â€” Language and Literacy
- Standard Brazilian Portuguese
- Regional vocabulary variations (medicamento vs remÃ©dio vs droga)
- Low reading ability (semi-literate â€” can decode words slowly)
- Functionally illiterate (can't read instructions, relies on images/icons)
- Immigrant patient (Portuguese as second language â€” Venezuelan, Haitian, etc.)
- Medical terminology confusion (princÃ­pio ativo vs nome comercial vs genÃ©rico)
- Font size sensitivity (needs larger text)
- Abbreviation confusion (mg, mL, UI, cp, comp, cps, gotas, mL)

### D7 â€” Cultural Factors
- Trusts technology completely (will follow app blindly)
- Distrusts technology ("the app is tracking me", "my data will be sold")
- Distrusts medicine/pharma ("this medication is poison")
- Self-medicates (common in Brazil â€” buys medication without prescription)
- Shares medications with family members
- Uses medication prescribed for someone else
- Prefers to ask the pharmacist rather than use an app
- Prefers to ask WhatsApp groups about medication
- Religious beliefs affecting medication adherence
- Fear of "the government knowing my medications"
- Privacy: doesn't want household members to know what they take (HIV, psych meds, etc.)
- Multiple doctors prescribing without coordination (polypharmacy risk)

### D8 â€” Environment of Use
- Home â€” well-lit living room (ideal)
- Home â€” dimly lit bedroom at night
- Home â€” bathroom (humidity, variable lighting)
- Home â€” kitchen (grease, water, steam)
- Pharmacy counter (bright lights, rushed, noisy)
- Hospital/clinic waiting room
- Hospital bed
- Doctor's office (during consultation)
- Car (parked)
- Car (as passenger, moving â€” vibration, lighting changes)
- Public transport (bus, metro â€” vibration, variable lighting, limited space)
- Outdoor â€” bright sunlight (screen hard to see)
- Outdoor â€” nighttime
- Workplace
- Restaurant/social setting (may want discretion)
- Elevator (brief moment, poor lighting)
- Airplane (no internet)

---

## CATEGORY E â€” THE TOGGLE/MODE SWITCH

### E1 â€” What Are the Modes?
- Mode 1: Barcode scan (point camera at barcode, auto-detect)
- Mode 2: Photo of box/label (take a picture, send for OCR/AI analysis)
- Mode 3: Photo of prescription (paper receita mÃ©dica â€” different framing/processing)
- Mode 4: Manual text search (type medication name)
- Mode 5: Voice search (speak medication name â€” separate from typing)
- Mode 6: Photo of pill itself (pill identification by image â€” shape, color, imprint)
- Mode 7: DataMatrix scan (technically different from barcode, but same camera)
- Should barcode scan and DataMatrix scan be the same mode?
- Should photo of box and photo of prescription be the same mode?
- Should there be a "browse by category" mode (e.g., "diabetes medications")?

### E2 â€” How Many Modes?
- 2 modes: Scan + Manual (simplest)
- 3 modes: Scan + Photo + Manual (balanced)
- 4 modes: Scan + Photo of box + Photo of prescription + Manual (granular)
- More than 4: cognitive overload for patients
- Progressive disclosure: start with 2, reveal more if needed
- "Smart mode": single camera view that auto-detects barcode vs text vs nothing

### E3 â€” Toggle UI Pattern
- Toggle switch (binary â€” only works for 2 modes)
- Segmented control / tab bar at top of camera view
- Segmented control at bottom of camera view
- Swipeable tabs (swipe left/right to change mode)
- Bottom sheet with mode options
- Floating action button with radial menu
- Full-screen mode selector before camera opens
- Inline text link ("NÃ£o conseguiu? Tente fotografar a caixa")
- Step-by-step: only show the next mode if the previous one failed
- Tabs + "More" overflow for additional modes
- Which pattern is most accessible?
- Which pattern works with one hand?
- Which pattern works with large text/accessibility settings?

### E4 â€” Iconography
- Barcode icon (lines) â€” universally recognized?
- Camera icon (for photo mode)
- Magnifying glass icon (for search/manual)
- Microphone icon (for voice)
- Prescription/document icon (for receita)
- Pill icon (for pill identification)
- Icons with text labels vs icons only
- Icon style consistency with the rest of the design system
- Icon size for touch targets (minimum 44x44pt per Apple HIG, 48x48dp per Material)
- Icon color states (active, inactive, disabled)
- Animated icons vs static

### E5 â€” Explaining Modes to Non-Tech Patients
- First-time tooltip/coach mark ("Aponte a cÃ¢mera para o cÃ³digo de barras")
- Onboarding tutorial before first scan
- Inline instruction text within each mode
- Animated hand/phone guide showing what to do
- Video tutorial (accessible from help)
- Audio instruction option
- "What's this?" help icon on each mode
- Language level: must be 5th-grade reading level or simpler
- Avoid jargon: "cÃ³digo de barras" yes, "EAN-13" no
- Avoid "scan" â€” not universally understood in Portuguese (use "ler" or "apontar")

### E6 â€” Camera Behavior When Switching Modes
- Does the camera stay on when switching between barcode and photo modes?
- Does the camera restart (visible flicker/black frame)?
- Does switching modes change camera resolution?
- Does switching modes change the viewfinder aspect ratio?
- Does switching from camera mode to manual entry turn off the camera?
- Does going back to camera mode re-request permission?
- Memory: does each mode restart or remember state?
- If patient was mid-scan and switches mode, is any state preserved?

### E7 â€” Animation and Transitions
- Slide transition between modes
- Fade transition
- No transition (instant switch)
- Overlay/guide animation change per mode
- Camera viewfinder shape change animation (barcode rectangle vs full-frame photo)
- Loading state between mode switch
- Should transition be < 300ms? (perceived instant)
- Reduced motion preference â€” disable animations

### E8 â€” Default Mode
- Default to barcode scan (most efficient when it works)
- Default to the most commonly used mode (analytics-driven)
- Default to the last mode the patient used (remember preference)
- Default based on context (coming from "add medication" â†’ barcode, coming from "I have a prescription" â†’ photo)
- Default for first-time users vs returning users

### E9 â€” Remember Last Used Mode
- Store preference in localStorage
- Store preference in user profile (server-side)
- Per-session memory only
- Reset after X days of inactivity
- What if the patient's scenario changed? (had a box last time, now has loose pills)

---

## CATEGORY F â€” SCAN DETECTION FEEDBACK

### F1 â€” Visual Feedback During Scanning
- Viewfinder overlay (rectangle showing where to position barcode)
- Animated scan line moving across the viewfinder
- Pulsing viewfinder border ("searching...")
- Corner brackets animation (focusing)
- Dimmed area outside the viewfinder (focus attention)
- Real-time barcode candidate highlighting (when partially detected)
- Laser-line style animation (like a supermarket scanner)
- "Aiming" indicator showing where the camera is focused
- Text instruction that changes dynamically ("Aproxime mais", "Mantenha firme")
- Progress indicator (e.g., "Detectando..." â†’ "Lendo..." â†’ "Encontrado!")

### F2 â€” Visual Feedback on Success
- Green border around viewfinder
- Green checkmark overlay
- Glow/pulse effect
- Viewfinder "closing" animation (brackets collapse)
- Card/overlay slides up with the medication name
- Background color flash (green tint)
- Confetti or celebratory micro-animation (too much?)
- The barcode itself gets highlighted in the camera feed (AR overlay)
- Duration of success state before transition: 0.5s? 1s? 1.5s?

### F3 â€” Sound Feedback
- Beep (classic scanner beep â€” but may feel clinical/scary)
- Soft chime (more friendly)
- No sound (many patients in quiet environments)
- Sound toggle setting
- Respect phone silent/vibrate mode
- Sound must not play if phone volume is at max (startling in public)
- Accessibility: sound as the ONLY feedback is not sufficient
- What sound for failure/error?

### F4 â€” Haptic Feedback
- Short vibration on success
- Android: Vibration API works in most browsers
- iOS Safari: Vibration API is NOT supported (no haptic via web)
- iOS: no workaround for web haptics (native app would be needed)
- Haptic pattern: single pulse vs double tap
- Haptic for error/failure (different pattern)
- Patient with phone on silent + no vibrate â€” no haptic feedback at all

### F5 â€” Immediate Post-Detection Display
- Overlay on camera view showing: medication name, concentration, form
- Overlay with "Ã‰ este medicamento?" confirmation
- Full-screen transition to a confirmation card
- Bottom sheet sliding up over camera
- Camera freezes on the detected frame
- Camera continues running behind overlay
- Loading spinner while looking up the barcode in the database
- What if lookup takes > 2 seconds? (show loading state)
- What if lookup takes > 5 seconds? (show timeout/retry option)

### F6 â€” Timing
- Barcode detected â†’ success feedback: < 200ms (must feel instant)
- Success feedback displayed: 800ms-1200ms (enough to register, not too long)
- Transition to result screen: after success feedback
- Total time from scan to result: < 3 seconds ideal, < 5 seconds acceptable
- If lookup is slow, when does the user lose patience?
- Allow user to dismiss/skip the success animation?

### F7 â€” Wrong Barcode Detected
- Pharmacy sticker barcode detected instead of medication EAN
- Display box barcode detected instead of individual unit
- Barcode from a nearby object on the table
- How to tell the user it's the wrong barcode?
- "Este cÃ³digo nÃ£o Ã© de um medicamento. Tente o cÃ³digo de barras da caixa do medicamento."
- Should the app learn to distinguish pharmacy barcodes from medication barcodes?
- Barcode format heuristics (pharmacy barcodes often have different lengths/prefixes)

### F8 â€” Barcode Not in Database
- Valid EAN-13 but not found in medication database
- Old/discontinued medication
- Very new medication (not yet in database)
- Imported medication (no Brazilian registry)
- Compounded medication (manipulado â€” no standard EAN)
- Food supplement with a pharmaceutical EAN
- "NÃ£o encontramos este medicamento" message
- Offer alternatives: "Tente fotografar a caixa" or "Busque pelo nome"
- Allow patient to report/request addition to database
- Log unknown barcodes for database expansion

---

## CATEGORY G â€” FALLBACK FLOWS

### G1 â€” Barcode Scan Fails
- After X seconds with no detection: show message "NÃ£o estamos conseguindo ler o cÃ³digo"
- What is X? 5 seconds? 10 seconds? 15 seconds?
- Offer to turn on flashlight
- Offer tips: "Aproxime mais", "Evite reflexos", "Tente em um local bem iluminado"
- Offer to switch to photo mode
- Count failures: after 2-3 failed attempts, suggest manual entry
- Don't make the patient feel stupid

### G2 â€” Photo Mode Fails
- Photo is too blurry to OCR
- Photo is too dark
- Photo is overexposed
- Photo contains no recognizable text
- Photo contains text but not medication-related
- OCR returned text but couldn't match to a medication
- Offer to retake with guidance
- Show the photo back to the patient with the problem highlighted
- After 2-3 failed photos, suggest manual entry

### G3 â€” OCR Fails
- OCR returned garbage text (non-Latin characters, random letters)
- OCR returned partial text (half the medication name)
- OCR returned correct text but wrong field (read the manufacturer instead of the name)
- OCR returned multiple candidates â€” which one?
- OCR language detection: Portuguese vs other languages
- OCR handling of pharmaceutical abbreviations
- OCR processing timeout
- OCR cost (if using cloud service): wasted API call on bad photo

### G4 â€” Manual Search Fails
- Patient doesn't know the exact medication name
- Patient knows only the princÃ­pio ativo but not the brand name
- Patient knows only the brand name but not the concentration
- Patient spells the name wrong (common with complex drug names)
- Search returns too many results (ambiguous query)
- Search returns zero results (misspelling, or medication not in database)
- Fuzzy search: how fuzzy? (Losartana vs Lozartana vs Losartan)
- Autocomplete suggestions: when to show, how many
- Search by voice as fallback to typing
- Search by therapeutic class ("meu remÃ©dio de pressÃ£o")

### G5 â€” All Methods Fail â€” Last Resort
- Let the patient create a medication entry with just a name (free text)
- Let the patient take a photo and save it for later identification
- Connect patient to support (human or AI chat)
- Log the failure for the team to investigate
- "NÃ£o conseguimos identificar. VocÃª pode adicionar manualmente."
- Manual entry form: what fields are minimally required?
- Can the patient ask their pharmacist and come back later?
- Bookmark/save partial progress to continue later
- Ask the patient to show it to a family member who can help

### G6 â€” Offline Scenarios
- Internet is down: can barcode scanning work offline? (yes, with a local barcode library â€” but heavy)
- Internet is down: photo/OCR cannot work (requires server)
- Internet is down: manual search could work with a local database cache
- How big is a local medication database? (tens of thousands of entries)
- Partial offline: barcode decoding works, database lookup fails
- Queue failed lookups to retry when online
- Show "VocÃª estÃ¡ offline" banner
- Cache recently scanned medications for offline access
- Progressive Web App: service worker caching strategy

### G7 â€” Server Down
- Barcode decoded locally but API is down
- Return cached results if the same barcode was scanned before
- Graceful error: "Nosso servidor estÃ¡ temporariamente indisponÃ­vel"
- Retry logic: automatic retry with exponential backoff
- Don't let the patient think they did something wrong
- Fallback to manual entry (which stores locally until sync)

### G8 â€” Patient Gives Up
- Detect abandonment: patient closes the camera, navigates away
- Save any partial state (barcode number, partial photo, search query)
- "Continuar de onde parou" when they come back
- Analytics: track where patients abandon (which step, which fallback)
- Re-engagement: notification? (careful â€” not too pushy)
- Offer simpler path: "Quer que a gente te ajude por WhatsApp?"

---

## CATEGORY H â€” THE PHOTO MODE (NON-BARCODE)

### H1 â€” What to Photograph
- Front of the box (nome comercial, concentraÃ§Ã£o â€” biggest text)
- Any side of the box (app should handle any angle/face)
- The label on a bottle
- The blister pack (if no box available)
- The bula (package insert â€” long document, hard to photograph)
- A prescription (receita mÃ©dica â€” different document entirely)
- A WhatsApp message (screenshot of doctor's text)
- A photo of a photo (patient took a photo before, now shows that)
- Multiple medications at once? (one photo with several boxes)

### H2 â€” Guide Overlay
- Rectangle overlay showing where to place the box face
- Corner brackets (like a document scanner)
- Text: "Posicione a frente da caixa dentro do quadro"
- Animated example (ghost image of a medication box)
- Different overlay for prescription vs box
- Overlay adapts to landscape/portrait
- Overlay dims the background
- Real-time feedback: "Texto detectado" / "Aproxime mais"

### H3 â€” Auto-Capture vs Manual Capture
- Auto-capture when text is detected and in focus (faster, but risky)
- Manual capture with a shutter button (patient has control)
- Hybrid: auto-capture with manual override
- Countdown before auto-capture (3, 2, 1... to reduce blur)
- Shutter button placement (bottom center, like native camera)
- Shutter button size (large, easy to tap â€” 60px+ diameter)
- Shutter button feedback (animation on tap)

### H4 â€” Photo Quality
- Minimum resolution for OCR: ~720p usable, 1080p ideal
- Maximum resolution to capture: no need for 4K+ (waste of bandwidth)
- Camera resolution constraints in getUserMedia
- JPEG quality level (0.7-0.85 balance between quality and size)
- Photo file size target: < 500KB for fast upload, < 1MB acceptable
- WebP vs JPEG (WebP smaller but check browser support)
- HEIF on iPhone (need to convert or handle)
- Orientation EXIF data (photo may appear rotated if not handled)

### H5 â€” Photo Compression
- Client-side compression before upload (canvas resize + toBlob)
- Target dimensions for OCR: 1280x960 or similar
- Compression library vs native canvas
- Progressive JPEG for upload progress?
- Upload progress indicator (especially on slow connections)
- Multipart form upload vs base64 encoding
- Chunked upload for large files on unreliable connections

### H6 â€” Photo Preview
- Show the captured photo before sending (let patient verify)
- Zoom/pan on the preview
- Brightness/contrast adjustment on preview? (probably overkill)
- "EstÃ¡ legÃ­vel?" confirmation
- Crop tool? (probably overkill for patients)
- Retake button (prominent, easy to find)
- Use button (confirm and send)

### H7 â€” Retake Flow
- Retake discards the photo and returns to camera
- How many retakes before suggesting a different mode?
- Each retake: same guidance or progressive guidance? ("Tente com mais luz")
- Fast retake: don't reload the camera, keep it running behind the preview

### H8 â€” Blurry/Dark/Overexposed Photos
- Detect blur before sending (client-side, Laplacian variance or similar)
- Detect darkness before sending (average brightness check)
- Detect overexposure
- Warn patient: "A foto parece desfocada. Tente manter o celular parado."
- Auto-suggest flashlight if too dark
- Auto-reject and force retake? Or send anyway with a warning?
- Server-side quality check after OCR attempt

### H9 â€” Photo of Prescription
- Different framing: full A5/A4 page vs small prescription pad
- Multiple medications on one prescription
- Handwritten prescriptions (doctor's handwriting â€” notoriously hard OCR)
- Printed prescriptions (easier OCR)
- Digital prescriptions (printed from system â€” cleanest OCR)
- Prescription from SUS (specific format)
- Prescription from private doctor (variable formats)
- Receita de controle especial (blue/yellow form â€” specific format with carbonless copies)
- Multiple pages (patient photographs page 1 of 2, misses page 2)
- Prescription in poor condition (folded, wrinkled, coffee-stained)
- Prescription with stamps/signatures obscuring text
- Prescription with abbreviations (medical shorthand)

### H10 â€” Photo of Screen
- WhatsApp message from doctor
- Screenshot of another app
- Photo of computer screen (moirÃ© pattern â€” interference between pixel grids)
- Photo of tablet screen
- Photo of printed PDF
- Reflections on the screen surface
- Screen brightness affecting photo exposure
- Screen color temperature affecting photo colors
- Resolution loss (photo of screen is inherently lossy)

---

## CATEGORY I â€” POST-SCAN (AFTER IDENTIFICATION)

### I1 â€” Confirmation Card
- Medication name (nome comercial)
- Active ingredient (princÃ­pio ativo)
- Concentration/dosage (e.g., 50mg, 500mg/5mL)
- Pharmaceutical form (comprimido, cÃ¡psula, soluÃ§Ã£o, creme, etc.)
- Manufacturer (laboratÃ³rio)
- Photo/image of the medication box (from database â€” for visual confirmation)
- Tarja (vermelha, preta, or OTC)
- ANVISA registry number (Registro MS)
- "Ã‰ este medicamento?" (confirmation prompt)
- "Sim, Ã© esse" button (primary action)
- "NÃ£o, nÃ£o Ã© esse" button (secondary action)
- "NÃ£o tenho certeza" option
- Card layout for different screen sizes
- Card scroll if content is long

### I2 â€” Wrong Medication Detected
- "NÃ£o Ã© esse" â†’ what happens?
- Offer alternative matches (did you mean...?)
- Return to scanner
- Switch to manual search with pre-filled text
- Ask: "Qual Ã© o nome do seu medicamento?" (free text)
- Log the mismatch (barcode X matched incorrectly)

### I3 â€” Multiple Possible Matches
- Same barcode maps to multiple products? (shouldn't happen with EAN, but database issues)
- OCR returned ambiguous text matching multiple medications
- Display a list of options
- How many options to show? (3-5 maximum)
- Each option shows name + concentration + form (enough to disambiguate)
- "Nenhuma dessas opÃ§Ãµes" at the bottom of the list
- Search refinement if none match

### I4 â€” Wrong Strength/Concentration
- Medication identified correctly but patient takes a different concentration
- "Ã‰ Losartana, mas eu tomo 100mg, nÃ£o 50mg"
- Allow changing the concentration from a list of available options
- What if the patient doesn't know their concentration?
- Pre-populate available concentrations from the database

### I5 â€” Pre-filling Frequency/Schedule from Bula
- Auto-suggest common regimens (e.g., "1 comprimido de 12 em 12 horas")
- Data source: structured bula data from ANVISA?
- Multiple indication regimens (same medication, different conditions, different dosing)
- Patient may have a DIFFERENT regimen from the bula (doctor prescribed differently)
- Always let patient override
- "Meu mÃ©dico receitou diferente" option
- Pre-fill but don't assume

### I6 â€” "NÃ£o Sei" (I Don't Know) Option
- For every field: medication name, concentration, frequency, schedule
- What happens when they select "NÃ£o sei"?
- Skip the field and flag for later
- Suggest asking their doctor/pharmacist
- Save partial medication entry
- "Complete depois" (complete later) workflow
- Reminder to complete incomplete medication entries
- Can the app infer anything from what IS known?

### I7 â€” Adding Medication to Profile
- Confirm all fields (name, concentration, form, frequency, times)
- Medication already exists in profile (duplicate detection)
- Is this a new medication or a refill of an existing one?
- Start date (when did/will the patient start taking it?)
- End date (temporary medication vs indefinite?)
- Prescribing doctor (optional but useful)
- Pharmacy where purchased (optional)
- Notes field (patient's own notes)
- Photo of the box saved to the medication record?

### I8 â€” Creating the Reminder
- Should reminder creation be part of the scan flow or separate?
- Pre-fill reminder times from the regimen
- Let patient adjust times ("Eu tomo de manhÃ£, nÃ£o de noite")
- Notification type: push notification, alarm, both?
- Notification permission request (another permission dialog)
- Smart timing: suggest times based on common patterns
- Link reminder to the specific medication scanned
- Recurring reminders: daily, weekly, "a cada 8 horas"
- PRN/SOS medications ("tomar quando sentir dor") â€” reminder model doesn't fit

### I9 â€” Success Screen
- "Medicamento adicionado com sucesso!"
- Summary of what was saved
- Visual delight (subtle animation â€” not confetti for a medical app)
- Clear next actions
- Satisfying but not patronizing

### I10 â€” "Add Another" Flow
- Prominent "Adicionar outro medicamento" button
- Returns to scanner (not to home)
- Counter: "2 de 5 medicamentos adicionados" (if patient said how many they have)
- Quick succession scanning (barcode â†’ confirm â†’ next, minimal friction)
- Bulk scanning mode? (scan multiple barcodes, then confirm all at once)
- What if the patient has 10+ medications? (fatigue, frustration)
- Save progress: "VocÃª adicionou 3 medicamentos. Continuar depois?"

### I11 â€” Going Back to Medication List
- Navigation from success screen
- Updated medication list shows the new medication
- Sort order: newest added at top? Alphabetical?
- Visual indicator on the newly added medication (new badge, highlight)
- Pull-to-refresh if data is stale
- Empty state (no medications yet)
- List vs card view of medications

---

## CATEGORY J â€” EDGE CASES NOBODY THINKS ABOUT

### J1 â€” Non-Medication Products Scanned
- Veterinary medication (pet meds have similar EAN barcodes)
- Cosmetic product (cream, lotion, sunscreen â€” looks like medication tube)
- Food supplement (collagen, protein, vitamins â€” has EAN, may be in pharma database)
- Homeopathic medication (may or may not be in ANVISA database)
- Traditional/herbal medication (fitoterÃ¡pico â€” registered with ANVISA but separate category)
- Phytotherapic (fitoterÃ¡pico registrado â€” has ANVISA registry)
- Flower essences (florais de Bach â€” no ANVISA registry)
- Essential oils (sometimes sold as "natural remedies")
- Baby formula (sold in pharmacies, has EAN)
- Medical devices (blood glucose strips, test kits â€” sold in pharmacies)
- Condoms/lubricants (sold in pharmacies, patient might be embarrassed)
- Handling: should the app say "Este nÃ£o Ã© um medicamento" or add it anyway?

### J2 â€” Expired Medication
- Barcode reads fine, medication is in database, but the expiration date has passed
- Should the app warn? Can the app even know? (expiration is in DataMatrix, not EAN-13)
- If OCR reads the validade from the photo â†’ "Este medicamento pode estar vencido"
- Legal/liability: can the app be responsible for not warning?
- What if the patient insists on adding it anyway?

### J3 â€” Recalled Medication
- ANVISA issues recalls (recolhimento/suspensÃ£o)
- If the barcode matches a recalled lot â†’ warning
- Lot number in DataMatrix or on the packaging
- Data source: ANVISA recall API or database
- Liability if the app fails to warn about a recall
- Frequency of recall database updates

### J4 â€” Accessibility Edge Cases
- Colorblind patient (can't see green success border, red error border)
- Color-safe feedback: icons, text, patterns in addition to color
- Deuteranopia (most common â€” red/green confusion)
- Protanopia, tritanopia (other types)
- Dark mode: camera UI colors must work on dark backgrounds
- Dark mode: success/error overlays on camera feed
- High contrast mode (Windows/Android accessibility setting)
- Font size at maximum system setting: does the camera UI overlay break?
- UI elements overlapping camera feed at large text sizes

### J5 â€” Screenshot and Sharing
- Patient takes a screenshot of the scan result
- Does the screenshot show medication info clearly? (for sharing with doctor)
- Share button to send result via WhatsApp (most common in Brazil)
- Share as text (medication name + dosage) vs image (screenshot)
- PDF export of medication list (for doctor appointments)
- Privacy: sharing exposes medication info â€” consent/warning?
- Deep link: shared result opens in the app for the recipient?

### J6 â€” Multiple Users on Same Phone
- Family members sharing one phone (very common in Brazil, especially elderly + caregiver)
- Profile switching (which patient am I adding for?)
- "Este medicamento Ã© para quem?" prompt
- Caregiver managing multiple patients' medications
- Privacy between profiles
- Accidental cross-contamination of medication lists
- Guest mode (someone borrows the phone to scan quickly)

### J7 â€” Other Edge Cases
- Patient scans while on a phone call (camera might be restricted)
- Patient receives a phone call during scanning (interruption)
- Patient receives a notification that obscures the camera UI
- Patient's phone storage is full (can't save photo)
- Patient's phone is in power saving mode (camera restricted, CPU throttled)
- Patient's phone date/time is wrong (affects expiration calculations)
- Patient uses a phone in a different country (roaming, different pharmacy standards)
- Patient scans a medication from another country (imported/traveling)
- Patient scans a medication that requires refrigeration (app should note storage conditions?)
- Patient scans a controlled substance (receita especial â€” app behavior?)
- Patient scans a medication they're allergic to (future feature: interaction checking)
- Patient scans the same medication twice (duplicate detection)
- Patient with multiple phones/devices (sync between devices)

---

## CATEGORY K â€” PRIVACY AND DATA

### K1 â€” Photo Storage
- Is the photo stored on the device?
- Is the photo uploaded to the server?
- If uploaded: encrypted in transit? (HTTPS â€” yes, but explicitly)
- If uploaded: encrypted at rest on the server?
- Photo retention policy: how long is it kept?
- Photo deleted after OCR processing? Or retained for ML training?
- Patient can view their uploaded photos?
- Patient can delete their photos?
- Photo associated with patient profile or anonymous?

### K2 â€” Cloud OCR
- If using Google Cloud Vision: photo sent to Google servers
- If using AWS Textract: photo sent to Amazon servers
- If using Azure Computer Vision: photo sent to Microsoft servers
- Google/AWS/Azure data processing agreements
- Data residency: where are the servers? (Brazil? US? EU?)
- Can the cloud provider use the photos for training?
- Open-source OCR alternatives (Tesseract â€” runs on server, data stays in your infra)
- On-device OCR (Tesseract.js or ML Kit â€” photo never leaves device)
- Trade-off: cloud OCR is more accurate, on-device is more private
- Hybrid: try on-device first, fall back to cloud with consent

### K3 â€” LGPD Consent
- Specific consent for camera access (beyond browser permission)
- Specific consent for photo processing
- Specific consent for medication data storage
- Specific consent for sharing data with cloud OCR providers
- Consent must be informed, free, unambiguous (LGPD Art. 8)
- Consent can be withdrawn at any time
- Consent record: when, what, version of terms
- Consent for minors (parent/guardian must consent under 18 â€” though LGPD says "crianÃ§a/adolescente" with special treatment)
- Consent for health data specifically (LGPD Art. 11 â€” sensitive data, requires explicit consent or health protection legal basis)
- Privacy policy: must describe all data processing in clear language
- DPO (Data Protection Officer / Encarregado): who is it?
- Data mapping: document all flows of personal + health data
- Legal basis: consent vs health protection vs legitimate interest
- Cross-border transfer: if using cloud services outside Brazil

### K4 â€” Scan History
- Patient can view history of scanned medications
- Patient can delete individual scans
- Patient can delete all scan history
- Patient can export their data (LGPD data portability right)
- Scan history includes: timestamp, barcode, matched medication, photo (if taken)
- Is scan history synced across devices?
- Scan history retention period

### K5 â€” Caregiver Scanning
- Caregiver scans medication for someone else
- Whose profile does it go to?
- Consent from the patient (the actual medication taker) for their data
- Caregiver delegation model (authorized to manage someone's medications)
- Multiple caregivers for one patient
- Professional caregiver vs family caregiver (different trust levels?)
- Audit: who added this medication and when?

### K6 â€” Audit Trail
- Log every scan attempt (barcode value, timestamp, result)
- Log every photo upload (hash, timestamp, result)
- Log every manual search (query, timestamp, result)
- Log every medication added/modified/deleted
- Log every consent given/withdrawn
- Log every data export/deletion request
- Logs for compliance, debugging, and analytics
- Log retention period (LGPD: no longer than necessary)
- Logs must not contain the photo itself (storage concern)
- Anonymization of logs for analytics

---

## CATEGORY L â€” PERFORMANCE AND RELIABILITY

### L1 â€” Speed Targets
- Barcode detection: < 500ms from first clear frame (patient perceives as instant)
- Barcode database lookup: < 1 second (API response)
- Total barcode scan to result: < 2 seconds (ideal), < 3 seconds (acceptable), > 5 seconds (failure)
- Photo capture to upload start: < 500ms
- Photo upload: depends on connection â€” < 2s on 4G, < 5s on 3G
- OCR processing: < 3 seconds (server-side)
- Total photo mode to result: < 5 seconds (ideal), < 8 seconds (acceptable)
- Manual search autocomplete: < 200ms per keystroke
- Mode switch: < 300ms (perceived instant)
- Camera startup: < 1.5 seconds

### L2 â€” Memory Usage
- Barcode scanning library (ZXing-js, QuaggaJS, etc.): ~200-500KB parsed JS
- Camera stream: ~30-50MB RAM for 720p stream processing
- Canvas for frame processing: additional ~10-20MB
- On-device OCR (if used): Tesseract.js model ~2-4MB download, ~50-100MB RAM during processing
- Low-end phones: 1-2GB total RAM, 200-300MB available for browser tab
- Risk: browser tab crashes due to OOM (Out of Memory)
- Memory leak from camera stream not properly released
- Memory leak from canvas elements not garbage collected
- Multiple scan attempts accumulating memory

### L3 â€” Battery Impact
- Camera active: significant battery drain
- Screen at high brightness (needed to see viewfinder): battery drain
- Continuous JS processing of camera frames: CPU-intensive, battery drain
- Flashlight on: additional battery drain
- GPS active (if location used): additional drain
- Total impact: scanning for 5 minutes might use 3-5% battery
- Warn patient if battery is < 10%?
- Optimize: process every Nth frame instead of every frame
- Optimize: reduce resolution for scanning (720p sufficient for barcodes)
- Stop camera when not actively scanning (tab backgrounded, etc.)

### L4 â€” Network Usage
- Barcode lookup: ~1-2KB request + response (negligible)
- Photo upload: ~200-500KB per photo (compressed)
- OCR result: ~1-5KB response
- Medication database cache: ~5-20MB (if caching locally)
- Patient on limited data plan: minimize uploads
- Patient on Wi-Fi vs mobile data: different behavior?
- Show data usage warning for photo upload on mobile data?
- Compress aggressively on slow connections
- Detect connection speed and adapt

### L5 â€” Crash Recovery
- App/browser crashes mid-scan: no data loss (nothing was saved yet)
- App crashes after barcode detected but before confirmation: re-scan needed
- App crashes after photo uploaded but before result: photo is on server, need to recover
- App crashes during "add medication" form: partial data lost
- Autosave form state to localStorage every few seconds
- "Parece que algo deu errado. Deseja continuar de onde parou?"
- Crash reporting: Sentry, Bugsnag, etc.
- Crash frequency monitoring (crash-free rate target: >99.5%)

### L6 â€” Battery Runs Out Mid-Scan
- Same as crash: no scan data saved
- On next app open: nothing to recover (scan is ephemeral until confirmed)
- If medication was being added (form): recover from autosave
- Phone dies during photo upload: server may have partial data â€” need cleanup

---

## CATEGORY M â€” ACCESSIBILITY

### M1 â€” Screen Reader
- VoiceOver (iOS) and TalkBack (Android) compatibility
- Camera viewfinder: what does the screen reader announce?
- "CÃ¢mera aberta. Aponte o celular para o cÃ³digo de barras do medicamento."
- Scan progress: announce when barcode is detected
- Scan result: announce medication name
- All buttons must have accessible labels (aria-label)
- Mode toggle: each mode must be announced
- Focus management: when camera opens, focus goes where?
- After scan: focus moves to the result card
- Tab order must be logical
- Touch gestures: screen reader changes touch behavior (double-tap to activate)
- Scanning with screen reader on: can a blind user actually align the camera? (realistically difficult â€” alternative mode needed)
- Alternative for blind users: skip camera entirely, go to manual entry or voice search
- Real-time audio feedback for camera alignment? (experimental â€” "Move o celular um pouco para a esquerda")

### M2 â€” Large Text Mode
- iOS Dynamic Type
- Android font size settings
- Camera overlay text must scale
- Buttons must remain tappable (text overflow doesn't break layout)
- Confirmation card must scroll if text is too large
- Fixed UI elements (viewfinder overlay) must not be affected by text scaling
- Test at 200% text size
- Test at maximum system font size

### M3 â€” Reduced Motion
- prefers-reduced-motion media query
- Disable scan line animation
- Disable success pulse/glow
- Disable viewfinder bracket animation
- Disable transition animations between modes
- Replace animations with instant state changes
- Ensure feedback is still clear without animation (use text, icons, color)

### M4 â€” Color Contrast
- WCAG 2.1 AA minimum: 4.5:1 for normal text, 3:1 for large text
- Camera overlay text on variable camera background: difficult to guarantee contrast
- Solution: text on semi-transparent dark background (pill/badge)
- Success green must have sufficient contrast
- Error red must have sufficient contrast
- Test with contrast checkers
- Test in grayscale mode (simulates total color blindness)

### M5 â€” One-Handed Use
- All interactive elements within thumb reach zone
- Bottom-aligned controls preferred
- Shutter button at bottom center
- Mode toggle at bottom
- No critical controls at the top of the screen
- Reachability mode support (iPhone swipe-down gesture)
- Phone size range: 5" to 6.7" â€” thumb reach varies
- Left-handed vs right-handed use

### M6 â€” Voice Control / Commands
- "Hey Siri" / "Ok Google" integration: not directly possible for web apps
- In-app voice search (speech-to-text for medication name)
- Web Speech API support (Chrome: good, Safari: limited)
- Voice feedback (text-to-speech for results): Web Speech API synthesis
- Voice-guided scanning (audio instructions during camera use)
- Voice confirmation ("Sim" / "NÃ£o" instead of tapping buttons)
- Language: Brazilian Portuguese speech recognition accuracy
- Medical term recognition in voice (drug names are often complex)
- Background noise handling (patient might be in noisy environment)

---

## CATEGORY N â€” TECHNICAL INFRASTRUCTURE (BONUS â€” you didn't ask but a CTO would insist)

### N1 â€” Barcode Scanning Library
- ZXing-js (most popular, supports EAN-13, EAN-8, QR, DataMatrix)
- QuaggaJS (focused on 1D barcodes, good EAN support)
- Dynamsoft Barcode Reader (commercial, very accurate, expensive)
- Built-in BarcodeDetector API (Chrome Android only, not Safari)
- html5-qrcode (wrapper library, easier API)
- Library size (bundle impact)
- WASM-based libraries (faster processing but larger download)
- Library maintenance/community (is it actively maintained?)
- Custom training for Brazilian pharmaceutical barcodes?
- Multi-format scanning (scan EAN-13 and DataMatrix simultaneously?)

### N2 â€” OCR Engine
- Google Cloud Vision (high accuracy, cost per request, data leaves device)
- AWS Textract (good for documents/prescriptions)
- Azure Computer Vision (good general OCR)
- Tesseract.js (open source, runs in browser, lower accuracy, higher CPU)
- PaddleOCR (open source, server-side, good accuracy)
- Apple Vision framework (on-device, iOS only, via native wrapper)
- Google ML Kit (on-device, Android mainly, can work in browser via WASM)
- Custom OCR model trained on Brazilian medication packaging (ideal but expensive to build)
- OCR post-processing: fuzzy match OCR output against medication database
- OCR confidence scores: threshold for "sure" vs "maybe" vs "no match"

### N3 â€” Medication Database
- ANVISA's official database (BulÃ¡rio EletrÃ´nico, Consulta de Medicamentos)
- CMED price table (includes all registered medications with details)
- VigiMed (pharmacovigilance data)
- EAN-to-medication mapping: does a public database exist? (not officially â€” must build/buy)
- Commercial databases (IQVIA, Close-Up, Interfarma)
- Database update frequency (new medications registered regularly)
- Database fields: GTIN, nome comercial, princÃ­pio ativo, concentraÃ§Ã£o, forma, laboratÃ³rio, tarja, registro MS, apresentaÃ§Ã£o
- Database size: ~30,000-50,000 unique product presentations in Brazil
- API design: barcode lookup endpoint, text search endpoint, fuzzy match endpoint
- Caching strategy: CDN for common lookups, local cache for patient's medications

### N4 â€” AI/ML Considerations
- Medication box image recognition (beyond OCR â€” classify the box visually)
- Pill identification from photo (color, shape, imprint â€” extremely hard, existing databases like Pillbox)
- Prescription handwriting recognition (specialized model needed)
- NLP for medication name extraction from free text
- Interaction checking AI (future feature â€” flag dangerous combinations)
- Personalization ML (predict next medication, suggest common regimens)
- All models: bias, accuracy, edge cases, hallucinations, liability

### N5 â€” Analytics and Monitoring
- Scan success rate (by method: barcode, photo, manual)
- Scan failure rate (by reason: not found, wrong barcode, camera error)
- Time to scan (distribution: P50, P90, P99)
- Fallback usage rate (how often do patients fall through to manual?)
- Abandonment rate (start scan â†’ never complete)
- Device/browser distribution (optimize for most common)
- Error rates by device/browser/OS combination
- Performance monitoring (page load, API latency, crash rate)
- User satisfaction (post-scan rating? NPS?)
- A/B testing framework (test different UI approaches)

### N6 â€” Testing
- Unit tests for barcode parsing logic
- Integration tests for camera â†’ decode â†’ API â†’ result flow
- Visual regression tests for camera UI overlay
- Real device testing matrix (minimum: iPhone SE, iPhone 15, Samsung A series, Samsung S series, Xiaomi Redmi, Motorola G series)
- Browser testing matrix (Safari, Chrome, Samsung Internet at minimum)
- Accessibility automated tests (axe, Lighthouse)
- Manual accessibility testing with screen readers
- Testing with actual medication boxes (physical test kit)
- Testing with damaged/dirty barcodes
- Testing in various lighting conditions
- Testing with elderly users (usability testing â€” real patients)
- Load testing (many concurrent scans hitting the API)
- Edge case test suite (every item in Category J)

---

## CATEGORY O â€” LEGAL AND REGULATORY (BONUS â€” a CTO in pharma would flag this)

### O1 â€” Regulatory
- ANVISA regulations on medication identification apps
- RDC 157/2017 (rastreabilidade â€” medication tracking)
- Is the app a "medical device"? (software as medical device â€” SaMD classification)
- If classified as SaMD: ANVISA registration required (RDC 185/2001, updated)
- If NOT SaMD (just a reminder tool): no registration, but compliance still needed
- CFM (Conselho Federal de Medicina) guidelines on health apps
- CFF (Conselho Federal de FarmÃ¡cia) guidelines
- LGPD (covered in Category K)
- Consumer protection (CDC â€” CÃ³digo de Defesa do Consumidor)
- Terms of use: disclaimers about medication identification accuracy
- "Este aplicativo nÃ£o substitui a orientaÃ§Ã£o do seu mÃ©dico ou farmacÃªutico"
- Liability if the app identifies a medication incorrectly and patient takes wrong medication

### O2 â€” Content and Medical Information
- Bula information: can the app display it? (ANVISA makes it public)
- Drug interaction information: source, accuracy, liability
- Dosage recommendations: source, accuracy, liability
- Contraindications: should the app show them? Legal risk?
- "Consulte seu mÃ©dico" â€” must appear prominently wherever medical info is shown
- Off-label use: app should not suggest uses not in the bula
- Pricing information: can the app show it? (CMED table is public)

---

That is the complete territory. 15 categories (A through O), approximately 500+ individual items mapped, covering hardware, software, UX, data, legal, edge cases, infrastructure, accessibility, and regulatory. Every item is listed without solutions â€” ready for prioritization and architecture planning.