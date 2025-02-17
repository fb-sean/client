import "dotenv/config";
import * as Topgg from "@top-gg/sdk";
import { captureException } from "@sentry/node";
import {
  WebhookClient,
  ActionRowBuilder,
  ButtonBuilder,
  hideLinkEmbed,
  MessageActionRowComponentBuilder,
} from "discord.js";
import express from "express";
import axios from "axios";
import { white, gray, green } from "chalk-advanced";
import WouldYou from "./wouldYou";

const app = express();
const webhook = new Topgg.Webhook(process.env.TOPGG_WEBHOOK);

export default class VoteLogger {
  private c: WouldYou;
  private api: Topgg.Api;
  public votes: Map<string, Topgg.ShortUser>;

  constructor(c: WouldYou) {
    this.c = c;
    if (!process.env.TOPGG_TOKEN) return;
    this.api = new Topgg.Api(process.env.TOPGG_TOKEN as string);
    this.votes = new Map();

    this.getVotes().then(() => {
      console.log(
        `${white("Would You?")} ${gray(">")} ${green(
          "Successfully updated votes",
        )}`,
      );
    });

    setInterval(
      () => {
        this.getVotes().then(() => {
          console.log(
            `${white("Would You?")} ${gray(">")} ${green(
              "Successfully updated votes",
            )}`,
          );
        });
      },
      15 * 60 * 1000,
    );
  }

  /**
   * Get all votes from top.gg
   * @return {Promise<void>}
   */
  async getVotes(): Promise<void> {
    const votes = await this.api.getVotes();

    this.votes = new Map();

    for (const vote of votes) {
      this.votes.set(vote.id, vote);
    }
  }

  /**
   * Start the api for the vote tracker
   * @return {void}
   */
  startAPI(): void {
    app.post("/wumpuswebhook", async (req, res) => {
      if (req.headers["authorization"] !== process.env.WUMPUS_WEBHOOK) return res.status(401).send({ error: "Unauthorized" });

      const {
        userId,
      } = req.body;

      await this.sendVoteMessage(userId, "wumpus.store");

      return res.status(200).send({ success: true });
    });

    app.post("/dblwebhook", webhook.listener(async (vote) => {
        await this.sendVoteMessage(vote.user, "top.gg");
      }),
    );

    app.listen(5643);
  }

  async sendVoteMessage(userId: string, website: string): Promise<void> {
    let userdata: any = null;

    await axios({
      method: "GET",
      url: `https://japi.rest/discord/v1/user/${userId}`,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })
      .then((res) => {
        userdata = res?.data?.data;
      })
      .catch((err) => {
        captureException(err);
        userdata = this.c?.users?.cache?.get(userId) ?? null;
      });

    if (!userdata?.username) return;

    let emojis = [
      "<a:jammiesyou:1009965703484424282>",
      "<a:nyancatyou:1009965705808056350>",
      "<a:partyparrotyou:1009965704621080678>",
      "<a:shootyou:1009965706978267136>",
      "<a:catjamyou:1009965950101110806>",
      "<a:patyou:1009964589678612581>",
      "<a:patyoufast:1009964759216574586>",
    ];

    const button =
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        [
          new ButtonBuilder()
            .setLabel("Vote!")
            .setStyle(5)
            .setEmoji("💻")
            .setURL(`https://${website}/bot/981649513427111957/vote`), // Change this to an object of websites if you would like to support more than wumpus and top.gg lol
        ],
      );

    const emojisRandom = emojis[Math.floor(Math.random() * emojis.length)];

    const webhookClient = new WebhookClient({
      url: process.env.LOG_VOTE as string,
    });

    console.log(
      `${white("Would You?")} ${gray(">")} ${green(
        `${userdata.tag} voted for me!`,
      )}`,
    );

    webhookClient
      .send({
        content: `${emojisRandom} Voted for me on ${hideLinkEmbed(
          `https://${website}/bot/981649513427111957/vote`,
        )}`,
        components: [button],
        username: `${userdata.tag
          .replace("Discord", "")
          .replace("discord", "")
          .replace("Everyone", "")
          .replace("everyone", "")}`,
        avatarURL: userdata.avatarURL,
      })
      .catch((err) => captureException(err));
  }
}
