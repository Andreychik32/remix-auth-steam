import { redirect, SessionStorage } from "@remix-run/server-runtime";
import {
  AuthenticateOptions,
  Strategy,
  StrategyVerifyCallback,
} from "remix-auth";
import { RelyingParty } from "openid";
import { PromiseAuthenticate, PromiseVerifyAssertion } from "./promises";
import SteamAPI, { PlayerSummary } from "steamapi";

export interface SteamStrategyOptions {
  returnURL: string;
  realm?: string;
  apiKey: string;
}

export type SteamStrategyVerifyParams = PlayerSummary;

export class SteamStrategy<User> extends Strategy<
  User,
  SteamStrategyVerifyParams
> {
  name = "steam";
  private options: SteamStrategyOptions;
  private relyingParty: RelyingParty;
  private steamApi: SteamAPI;

  constructor(
    options: SteamStrategyOptions,
    verify: StrategyVerifyCallback<User, SteamStrategyVerifyParams>
  ) {
    super(verify);
    this.options = options;
    this.relyingParty = new RelyingParty(
      this.options.returnURL,
      null,
      true,
      false,
      []
    );
    this.steamApi = new SteamAPI(options.apiKey);
  }

  async authenticate(
    request: Request,
    sessionStorage: SessionStorage,
    options: AuthenticateOptions
  ): Promise<User> {
    try {
      const result = await PromiseVerifyAssertion(this.relyingParty, request);

      if (!result.authenticated || !result.claimedIdentifier)
        return this.failure(
          `Not authenticated from result`,
          request,
          sessionStorage,
          options
        );
      try {
        const userSteamID = result.claimedIdentifier
          .toString()
          .split("/")
          .at(-1)!;

        const steamUserSummary = await this.steamApi.getUserSummary(
          userSteamID
        );

        const user = await this.verify(steamUserSummary);
        return this.success(user, request, sessionStorage, options);
      } catch (error) {
        let message = (error as Error).message;
        return this.failure(message, request, sessionStorage, options);
      }
    } catch {
      const result = await PromiseAuthenticate(this.relyingParty);
      throw redirect(result);
    }
  }
}
