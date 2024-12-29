import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

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
  private roomId: string | null = null;
  currentGameInfo = this.gameInfo.asObservable();
  currentmessage = this.message.asObservable();
  currentFails = this.fails.asObservable();

  setWs(ws: WebSocket | null) {
    this.ws = ws;
  }

  getWs() {
    return this.ws;
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

  setFails(fails: number) {
    this.fails.next(fails);
  }

  setMessage(msg: string) {
    this.message.next(msg);
  }
}
