import { Injectable } from '@angular/core';
import { BehaviorSubject, lastValueFrom } from 'rxjs';
@Injectable({
  providedIn: 'root',
})
export class ServerConstantsService {
  constructor() {}

  private sessionId!: string;
  private ws!: WebSocket | null;
  private gameInfo = new BehaviorSubject<any>(null);
  private message = new BehaviorSubject<any>(null);
  private fails = new BehaviorSubject<any>(null);
  private continueGame = new BehaviorSubject<boolean>(false);
  private hangman = new BehaviorSubject<boolean>(true);
  private roomId: string | null = null;
  private currentGameInfoObj: any;
  continueOption = this.continueGame.asObservable();
  showHangman = this.hangman.asObservable();
  currentGameInfo = this.gameInfo.asObservable();
  currentmessage = this.message.asObservable();
  currentFails = this.fails.asObservable();

  setWs(ws: WebSocket | null) {
    this.ws = ws;
  }

  getWs() {
    return this.ws;
  }

  showContinueOption() {
    this.continueGame.next(true);
  }

  hideContinueOption() {
    this.continueGame.next(false);
  }

  hideHangman() {
    this.hangman.next(false);
  }

  getContinueOption() {
    return this.continueGame.getValue();
  }

  setRoomId(roomId: string) {
    this.roomId = roomId;
  }

  getRoomId() {
    return this.roomId;
  }

  setSessionId(session: string) {
    this.sessionId = session;
  }

  getSessionId() {
    return this.sessionId;
  }

  setgameInfo(info: any) {
    this.gameInfo.next(info);
  }

  getGameInfo() {
    return this.gameInfo.getValue();
  }

  addKeytoState(infos: any) {
    this.currentGameInfoObj = this.getGameInfo();
    if (infos.state.count) {
      this.currentGameInfoObj.state.count = infos.state.count;
    }
    if (infos.state.keys) {
      this.currentGameInfoObj.state.keys.push(infos.state.keys);
    }
    if (infos.end) {
      this.currentGameInfoObj.state.guessedLetters = infos.state.guessedLetters;
    } else {
      infos.state.guessedLetters.map((letter: any) => {
        this.currentGameInfoObj.state.guessedLetters.push(letter);
      });
    }
    this.gameInfo.next(this.currentGameInfoObj);
  }

  setFails(fails: number) {
    this.fails.next(fails);
  }

  setMessage(msg: string) {
    this.message.next(msg);
  }
}
