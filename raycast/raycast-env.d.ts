/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Server URL - Your Vaultflare backend URL (e.g. https://api.example.com) */
  "serverUrl": string,
  /** Email - Your Vaultflare account email */
  "email": string,
  /** Master Password - Your master password (stored encrypted by Raycast) */
  "masterPassword": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-vault` command */
  export type SearchVault = ExtensionPreferences & {}
  /** Preferences accessible in the `add-cipher` command */
  export type AddCipher = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-vault` command */
  export type SearchVault = {}
  /** Arguments passed to the `add-cipher` command */
  export type AddCipher = {}
}

