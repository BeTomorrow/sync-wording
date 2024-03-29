import chalk from "chalk";
import fs from "fs";

import { Credentials, OAuth2Client } from "google-auth-library";
import http from "http";
import open from "open";
import url from "url";

import { defaultCredentials } from "./DefaultCredentials";
const TOKEN_PATH = ".google_access_token.json";

export class GoogleAuth {
  async authorize(
    credentials_path: string,
    scopes: string[]
  ): Promise<OAuth2Client> {
    return new Promise(async (resolve, reject) => {
      const credentials = await this.loadCredentials(credentials_path);
      const { client_secret, client_id, redirect_uris } = credentials.installed;
      const oAuth2Client = new OAuth2Client(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      // Check if we have previously stored a token.
      let token = await this.readToken();
      if (!token) {
        token = await this.getAccessToken(oAuth2Client, scopes);
        await this.writeToken(token);
      }
      oAuth2Client.setCredentials(token);
      resolve(oAuth2Client);
    });
  }

  async loadCredentials(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (path && path.length > 0) {
        fs.readFile(path, (err, content) => {
          if (err) {
            console.log("Error loading client secret file:", err);
            reject(err);
          } else {
            resolve(JSON.parse(content.toString()));
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
            let code: string;
            if (!Array.isArray(query.code)) {
              code = query.code;
            } else {
              code = query.code[0] ?? "";
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
          resolve(JSON.parse(token.toString()));
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

  createServer(
    oAuth2Client: OAuth2Client,
    resolve: (value: Credentials | PromiseLike<Credentials>) => void,
    reject: (reason?: any) => void
  ) {
    return http
      .createServer(async function (req, res) {
        if (req?.url?.startsWith("/oauth2callback")) {
          const query = url.parse(req.url, true).query;
          if (query.error) {
            // An error response e.g. error=access_denied
            reject("Error:" + query.error);
          } else {
            let code: string;
            if (!Array.isArray(query.code)) {
              code = query.code;
            } else {
              code = query.code[0] ?? "";
            }
            // Get access and refresh tokens (if access_type is offline)
            let { tokens } = await oAuth2Client.getToken(code);
            resolve(tokens);
            res.end("successful authentification");
          }
        } else {
          reject("No url mathching");
          res.end("authentification failed");
        }
      })
      .listen(8181);
  }
}
