# Design System Strategy

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Ethereal Observatory."** 

Unlike traditional "flat" or "card-based" interfaces that feel rooted in 2D geometry, this system treats the screen as a window into an infinite, three-dimensional digital cosmos. It is designed to feel like a "Silent Authority"—intelligent, cinematic, and profoundly premium. We achieve this by breaking the rigid grid through intentional asymmetry, using floating layers that respond to light, and employing high-contrast typography scales that command attention without shouting. Every interaction should feel like navigating a high-tech star map: fluid, glowing, and deeply immersive.

---

## 2. Colors & Atmospheric Depth
Our palette is rooted in the void of space, utilizing a sophisticated hierarchy of dark tones and luminous accents to guide the eye.

### Tonal Foundations
*   **The Infinite Background:** Use `surface` (`#0e0e0e`) as the base. 
*   **Atmospheric Gradients:** Main hero sections and backgrounds must utilize rich radial gradients transitioning from `primary_container` (`#7c4dff`) to `surface`. These are not "colors" but "light sources" that provide a visual soul to the interface.

### The "No-Line" Rule
Traditional 1px solid borders for sectioning are strictly prohibited. Layout boundaries must be defined solely through:
1.  **Background Shifts:** Use `surface_container_low` against a `surface` background to denote a new zone.
2.  **Tonal Transitions:** Use soft, large-scale gradients to separate content blocks.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers:
*   **Lowest Layer:** `surface_container_lowest` (#000000) for deep-set elements.
*   **Default Layer:** `surface` (#0e0e0e).
*   **Elevated Glass:** Use `surface_container_high` (#201f1f) or `surface_container_highest` (#262626) at 60-80% opacity with a `20px - 40px` backdrop-blur.

### Signature Textures
Main CTAs or primary focus areas should leverage a "Chrome-Glass" gradient: a transition from `primary` (`#a68cff`) to `secondary` (`#00daf3`). This creates a high-tech, iridescent shimmer that feels bespoke and expensive.

---

## 3. Typography
The typography is an exercise in editorial confidence. We pair the structural precision of *Manrope* for displays with the modern clarity of *Inter* for utility.

*   **Display & Headline (Manrope):** Large, dramatic, and spaced. For `display-lg` (3.5rem) and `headline-lg` (2rem), increase letter-spacing to `0.05em` to create an airy, premium feel.
*   **Titles (Inter):** High-contrast sizing. Titles should feel authoritative.
*   **Labels (Space Grotesk):** Use `label-md` and `label-sm` for technical data or micro-copy. These should be set in uppercase with `0.1em` tracking to mimic high-tech instrument readouts.
*   **Visual Hierarchy:** Titles and Headlines use `on_surface` (#e8e5e4), while secondary body text uses `on_surface_variant` (#adaaaa) to ensure the "Silent Authority" isn't compromised by visual noise.

---

## 4. Elevation & Depth
Depth is not an effect; it is a structural pillar of the design system.

### The Layering Principle
Depth is achieved by stacking surface-container tiers. Place a `surface_container_lowest` card on a `surface_container_low` section to create a soft, natural "recess" without needing a shadow.

### Glassmorphism & The "Ghost Border"
For floating components (Modals, Hovering Cards):
*   **Backdrop:** 60% opacity of `surface_bright` with a 30px blur.
*   **The Edge:** Use a 1px "Ghost Border" using `primary_fixed` (#c8b7ff) at **15% opacity**. This creates a crystalline edge that catches the "light" of the background.
*   **Inner Glow:** Apply a subtle `0px 0px 10px` inner shadow using `primary` at 10% opacity to simulate light refracting through glass.

### Ambient Shadows
When a floating effect is required, shadows must be extra-diffused:
*   **Blur:** 40px to 80px.
*   **Color:** Use a tinted version of the background (e.g., `primary_container` at 8% opacity) rather than black. This mimics natural light bleed in a spatial environment.

---

## 5. Components

### Buttons
*   **Primary:** A gradient fill from `primary_container` to `primary`. No border. High roundedness (`full`).
*   **Secondary (Glass):** `surface_variant` at 20% opacity, 20px blur, with a 1px `outline_variant` border at 30% opacity.
*   **Interaction:** On hover, the "Ghost Border" opacity should increase from 15% to 50%, and an ambient glow (`primary_dim`) should appear behind the button.

### Floating Cards
*   **Style:** Forbid the use of divider lines. Separate content using vertical whitespace from the `xl` (1.5rem) scale.
*   **Background:** High-blur glassmorphism.
*   **Rounding:** Always use `xl` (1.5rem) for cards to maintain a soft, premium feel.

### Input Fields
*   **State:** Default state is a `surface_container_highest` background with no border.
*   **Focus:** The background shifts to `surface_bright` and a 1px glow border of `secondary` (#00daf3) appears at 40% opacity.

### Chips (Navigation/Status)
*   Small, pill-shaped (`full` roundedness). Use `label-sm` (Space Grotesk) typography in all-caps.
*   Use `secondary_container` for active states to provide a "cyber" highlight.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical layouts. Let elements overlap slightly to suggest 3D depth.
*   **Do** use "Hero" light sources. Place a large, soft radial gradient of `primary_dim` behind your most important content.
*   **Do** respect the void. White space (black space, in this context) is your most valuable tool for establishing a premium feel.

### Don't
*   **Don't** use 100% opaque, high-contrast borders. They break the immersive, ethereal illusion.
*   **Don't** use standard "Drop Shadows." If a shadow looks like a shadow, it’s too heavy. It should look like an ambient occlusion.
*   **Don't** crowd the interface. If a screen feels "busy," increase the vertical spacing and remove decorative elements. Let the typography and glass do the work.
*   **Don't** use pure white (#ffffff) for large bodies of text. Use `on_surface` (#e8e5e4) to reduce eye strain and maintain the dark atmosphere.