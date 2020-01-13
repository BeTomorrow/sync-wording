import fs from "fs";
import readline from "readline";
import { google } from "googleapis";
import { OAuth2Client, Credentials } from "google-auth-library";
import chalk from "chalk";
import open from "open";

const TOKEN_PATH = ".google_access_token.json";

export class GoogleAuth {
  async authorize(
    credentials_path: string,
    scopes: string[]
  ): Promise<OAuth2Client> {
    return new Promise(async (resolve, reject) => {
      const credentials = await this.loadCredentials(credentials_path);
      const { client_secret, client_id, redirect_uris } = credentials.installed;
      const oAuth2Client = new google.auth.OAuth2(
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
      fs.readFile(path, (err, content) => {
        if (err) {
          console.log("Error loading client secret file:", err);
          reject(err);
        } else {
          resolve(JSON.parse(content.toString()));
        }
      });
    });
  }

  private async getAccessToken(
    oAuth2Client: OAuth2Client,
    scopes: string[]
  ): Promise<Credentials> {
    return new Promise((resolve, reject) => {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes
      });

      console.log(
        "Authorize this app by visiting this url:",
        chalk.green(authUrl)
      );
      open(authUrl);
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question("Enter the code from that page here: ", code => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
          if (err) {
            console.error("Error retrieving access token", err);
            reject(err);
          } else {
            resolve(token!);
          }
        });
      });
    });
  }

  private async readToken(): Promise<Credentials> {
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
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), err => {
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
