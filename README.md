# terrarium

**paste any website. watch a one-of-a-kind plant grow from its DNA.**

terrarium reads a site's public markup — its colours, fonts, page weight, number
of elements, links, images, load speed, and whether it's secure — and grows a
generative plant from those traits, sealed in a little glass globe. faster sites
grow more vigorously; heavier pages grow taller; the site's own palette becomes
the blooms and leaf tint; https keeps it lush. it's deterministic — the same URL
always grows the same plant.

built with three.js. the only server-side piece is a tiny fetch proxy
(`/api/raw`) that reads a site's HTML so the browser can (it's otherwise
CORS-blocked), with an SSRF guard, an 8s timeout, and a 500 KB cap.

**Live → [terrarium-flax.vercel.app](https://terrarium-flax.vercel.app)** <!-- updated after deploy -->

## Run locally

```bash
python3 -m http.server 8400
# open http://localhost:8400
```

Locally there's no serverless function, so the site fetch falls back to a public
CORS reader. On Vercel it uses `/api/raw`.

## How a site becomes a plant

| site trait                | → | plant feature        |
| ------------------------- | - | -------------------- |
| colours                   | → | blooms + leaf tint   |
| fonts (serif / sans / mono) | → | leaf shape         |
| elements (tags)           | → | branchiness          |
| links                     | → | leaf density         |
| images                    | → | blooms               |
| page weight (bytes)       | → | height               |
| load speed (ms)           | → | vigour               |
| https                     | → | lushness / health    |

Nothing is stored — the site is fetched once to read its public markup, then
forgotten.

By [Ravindra Sisodia](https://github.com/Ravdesigns).
