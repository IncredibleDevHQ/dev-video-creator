The adjacent design, motion, SVG and technical-animation references are copied
from diffusionstudio/lottie at commit
3c72912fad543897f90045ed4d355813837927fc (MIT; LICENSE alongside).

Source: https://github.com/diffusionstudio/lottie/tree/3c72912fad543897f90045ed4d355813837927fc/skills/text-to-lottie/references

Files: design-taste.md, motion-taste.md, recipe-svg-animation.md,
recipe-diagram-technical.md (copied as-is); svg-compatibility.md (adapted for
the native SVG/SMIL runtime — its renderer sections refer to the Studio's
production renderer and finite SMIL clips, not Skottie/Lottie JSON; marked as
adapted in its header).

Incredible uses these for authoring judgment. The explainer route currently
authors editable SVG/SMIL and verifies it in its production Chromium renderer;
it does not claim to generate Lottie JSON or to include the upstream Skottie
player. The native performance contract is documented in ../scene-contract.md.
