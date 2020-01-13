# Sync Wording

This tool allow you to manage app's wording with simple Google Sheet file. Just create a sheet with columns for keys and wording. This tool will generate wording files. Your product owner will be able to edit himself apllication's wording

## Quick Start

You can find a sample sheet [here](https://docs.google.com/spreadsheets/d/18Zf_XSU80j_I_VOp9Z4ShdOeUydR6Odyty-ExGBZaz4/edit?usp=sharing) but it's just a simple sheet with one column for keys and columns for languages like this

| Keys                 | English   | French |
| -------------------- | --------- | ------ |
| user.firstname_title | Firstname | Prénom |
| user.lastname_title  | Lastname  | Nom    |

Install sync-wording as dev dependencies

```bash

    npm install @betomorrow/sync-wording --save-dev

```

And create wording config file named `wording_config.json` at project root location.

```json
{
  "sheetId": "18Zf_XSU80j_I_VOp9Z4ShdOeUydR6Odyty-ExGBZaz4",
  "output_dir": "src/assets/strings/",
  "languages": {
    "en": {
      "column": "B"
    },
    "fr": {
      "column": "C"
    }
  }
}
```

Add scripts lines to invoke tools easily with npm in `package.json`

```json
{
  "scripts": {
    "upgrade-wording": "sync-wording --upgrade"
  }
}
```

Then run

```bash
  npm run upgrade-wording
```

It will ask you to grant access on Google Sheet

```bash
> Task :app:downloadWording
Please open the following address in your browser:
  https://accounts.google.com/o/oauth2/auth?access_type=offline&client_id=971125274965-0glt9eqo63417es0nbhkmb6rj2i31g2p.apps.googleusercontent.com&redirect_uri=http://localhost:8888/Callback&response_type=code&scope=https://www.googleapis.com/auth/drive

```

Copy / Paste url in your browser, accept authorization and close browser

[Authorization Sample]

It will update wording files : `${output_dir}/en.json` and `${output_dir}/fr.json`

## Options

This tools support 3 options

- **`--config`** : Configuration path
- **`--upgrade`** : Export sheet in local xlsx file that you can commit for later edit. It prevent risks to have unwanted wording changes when you fix bugs. And then update wording
- **`--update`** : Update wording files from local xlsx file

## Complete Configuration

```json
{
  "credentials": "credentials.json", // Optional, json google api service credentials, default : use embedded credentials
  "wording_file": "wording.xlsx", // Optional, local xlsx wording file path

  "sheetId": "THE SHEET ID", // *Required*
  "shhetNames": ["commons", "app"], // Optional, default: use all sheets
  "sheetStartIndex": 2, // Optional, start row index, default : 2
  "keyColumn": "A", // Optional, default : "A"

  "output_dir": "src/assets/strings/",
  "languages": {
    "en": {
      "output": "src/assets/strings/default.json", // Optional, default: "${output_dir}/${language_name}.json"
      "column": "B"
    },
    "fr": {
      "output": "src/assets/strings/fr.json",
      "column": "C"
    }
    // [...] Add more languages here
  }
}
```

## Note

This tool includes Google Projet credentials for convenience use but you can setup your own projet. Create new project in [GCP Console](https://console.cloud.google.com) then enable **Drive API** in _API library_ and create and download credentials.
