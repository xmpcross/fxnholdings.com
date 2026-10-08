# fxnholdings.com

Static site for FXN Holdings (Perth, WA · ABN 53 274 423 748), hosted on Netlify.

- Page content lives in `_src/pages/*.html`; the shared header, footer and logo are in `_src/partials/`.
- Styles: `assets/site.css`. Behaviour (Perth clock, menu, reveal, contact form): `assets/site.js`.
- Rebuild the HTML at the site root after editing anything in `_src/`:

```bash
python3 _src/build.py
```

The contact form posts to Netlify Forms (`form-name=contact`), registered through `netlify-forms.html`.
