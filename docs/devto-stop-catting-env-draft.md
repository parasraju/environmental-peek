# Stop Catting Your .env File

I typed `cat .env` in a terminal while someone was watching. The values were on the screen.

That leak has three routes. You paste the file into chat. You share your screen. A CI log prints the file.

You rarely need the values. You need to know which keys are set and which are missing.

[environmental-peek](https://www.npmjs.com/package/environmental-peek) is the `envpeek` command. The package is at v0.5.1. It had 1,600 downloads on Nov 19, 2026.

Stop catting your .env file. Check .env without showing secrets.

1. `envpeek` shows which keys are set and which are empty, with values masked. Look at the key names.
2. `envpeek check` reports duplicate keys and bad quoting. Look at the key name and the line number.
3. `envpeek diff` compares `.env` with `.env.example`. Look for the missing key you forgot to set.

Key names only. The values stay masked.
