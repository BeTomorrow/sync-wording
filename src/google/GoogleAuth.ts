import chalk from "chalk";
import fs from "fs";

import { Credentials, OAuth2Client } from "google-auth-library";
import http from "http";
import open from "open";
import url from "url";

import { AuthRequiredError } from "../errors";
import { defaultCredentials } from "./DefaultCredentials";
const TOKEN_PATH = ".google_access_token.json";

export function hasStoredToken(): boolean {
  return fs.existsSync(TOKEN_PATH);
}

export class GoogleAuth {
  /**
   * Non-interactive authorization: requires a previously stored token.
   * Fails fast with an actionable message instead of opening a browser,
   * so the command stays usable from CI and AI agents.
   */
  async authorize(
    credentials_path: string,
    scopes: string[]
  ): Promise<OAuth2Client> {
    const oAuth2Client = await this.createClient(credentials_path);
    const token = await this.readToken();
    if (!token) {
      throw new AuthRequiredError(
        `No stored Google access token ("${TOKEN_PATH}" not found). ` +
          `Run "npx sync-wording auth" once to authenticate interactively.`
      );
    }
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  /**
   * Interactive login: opens a browser, stores the token for later
   * non-interactive runs. Used by the explicit "auth" command.
   */
  async login(credentials_path: string, scopes: string[]): Promise<void> {
    const oAuth2Client = await this.createClient(credentials_path);
    const token = await this.getAccessToken(oAuth2Client, scopes);
    await this.writeToken(token);
  }

  private async createClient(credentials_path: string): Promise<OAuth2Client> {
    const credentials = await this.loadCredentials(credentials_path);
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    return new OAuth2Client(client_id, client_secret, redirect_uris[0]);
  }

  async loadCredentials(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (path && path.length > 0) {
        fs.readFile(path, (err, content) => {
          if (err) {
            reject(
              new AuthRequiredError(
                `Can't read credentials file "${path}": ${err.message}`
              )
            );
          } else {
            try {
              resolve(JSON.parse(content.toString()));
            } catch (e: any) {
              reject(
                new AuthRequiredError(
                  `Invalid credentials file "${path}": ${e.message}`
                )
              );
            }
          }
        });
      } else {
        resolve(defaultCredentials);
      }
    });
  }

  private async getAccessToken(
    oAuth2Client: OAuth2Client,
    scopes: string[]
  ): Promise<Credentials> {
    const server = http.createServer();

    const token = await new Promise<Credentials>((resolve, reject) => {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
      });

      server.on("request", async (req, res) => {
        if (req?.url?.startsWith("/oauth2callback")) {
          const query = url.parse(req.url, true).query;
          if (query.error) {
            // An error response e.g. error=access_denied
            reject("Error:" + query.error);
            req.destroy();
          } else {
            let code: string | undefined;
            if (!Array.isArray(query.code)) {
              code = query.code;
            } else {
              code = query.code[0] ?? "";
            }
            if(!code) {
              reject("No code found");
              req.destroy();
              return;
            }
            // Get access and refresh tokens (if access_type is offline)
            let { tokens } = await oAuth2Client.getToken(code);
            resolve(tokens);
            res.end("successful authentification");
            req.destroy();
          }
        } else {
          reject("No url mathching");
          res.end("authentification failed");
          req.destroy();
        }
      });
      server.listen(8181);

      console.log(
        "Authorize this app by visiting this url:",
        chalk.green(authUrl)
      );

      open(authUrl);
    });
    server.close();
    return token;
  }

  private async readToken(): Promise<Credentials | undefined> {
    return new Promise((resolve, reject) => {
      fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) {
          resolve(undefined);
        } else {
          try {
            resolve(JSON.parse(token.toString()));
          } catch {
            // Corrupt/truncated token: treat as no token so authorize()
            // raises AuthRequiredError (exit 3) pointing to "auth".
            resolve(undefined);
          }
        }
      });
    });
  }

  private async writeToken(token: Credentials): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("Token stored to", TOKEN_PATH);
          resolve();
        }
      });
    });
  }
}
