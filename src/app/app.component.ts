import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ServerConstantsService } from './services/server-constants.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  sessionIdIsLoaded: boolean = false;
  constructor(
    private http: HttpClient,
    private serverConst: ServerConstantsService
  ) {}
  title = 'hangman';
  showgame: boolean = false;
  turn!: number;
  gameAction!: {
    state: { keys: string; guessedLetters: Array<any> };
  };
  gameInfo: any | null = null;
  currentGameID: string | null = null;
  currentGameInfo!: any;

  ngOnInit(): void {
    this.serverConst.currentGameInfo.subscribe((info) => {
      if (info?.players !== undefined) {
        this.currentGameInfo = {
          ...this.currentGameInfo,
          players: info?.players,
        };
      }
      if (info?.state?.count !== undefined) {
        this.currentGameInfo['count'] = info?.state?.count;
        this.turn = this.currentGameInfo?.count;
      }
    });
    let httpHeaders = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
      }),
      withCredentials: true,
    };
    this.http
      .get('http://localhost:3000', httpHeaders)
      .subscribe((res: any) => {
        this.serverConst.setSessionId(res.sessionId);
        this.sessionIdIsLoaded = true;
      });
  }

  enterGame(event: boolean) {
    this.showgame = event;
  }

  setGameInfo(info: any) {
    this.gameInfo = { ...this.gameInfo, ...info };
  }
}
