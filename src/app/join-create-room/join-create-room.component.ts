import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { NgForm } from '@angular/forms';
import { lastValueFrom, throwError } from 'rxjs';
import { ServerConstantsService } from '../services/server-constants.service';

@Component({
  selector: 'main[app-join-create-room]',
  templateUrl: './join-create-room.component.html',
  styleUrls: ['./join-create-room.component.scss'],
})
export class JoinCreateRoomComponent implements OnInit {
  currentGameInfo: any;
  currentMessage: string = '';
  continueOption: boolean = false;
  constructor(
    private http: HttpClient,
    private serverConstant: ServerConstantsService
  ) {}

  sessionId!: string;
  @ViewChild('form') form!: NgForm;
  @ViewChild('yusername') usernameInput!: NgForm;
  @Output() gameRoomEntered = new EventEmitter<boolean>();
  @Input() continueGameOpt = false;
  username: string | null = null;
  roomId: string | null = null;
  randomWordSelected: boolean = false;

  word: string | null = null;
  ws: WebSocket | null = this.serverConstant.getWs();
  httpHeaders = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
    }),
    withCredentials: true,
  };

  async ngOnInit() {
    if (!this.continueGameOpt) {
      this.connectWebSocket(); // Ensure WebSocket connection is established before proceeding
    }
    this.sessionId = this.serverConstant.getSessionId();

    this.serverConstant?.continueOption?.subscribe((proceed) => {
      this.continueOption = proceed;
    });

    // Wait for the current message to be fetched
    this.currentMessage = await lastValueFrom(
      this.serverConstant.currentmessage
    );

    // Wait for the current game info to be fetched
    this.currentGameInfo = await lastValueFrom(
      this.serverConstant.currentGameInfo
    );
  }

  getHttp() {
    return this.http;
  }

  async getRandomTranslatedWord(http: HttpClient) {
    while (true) {
      try {
        const res = await lastValueFrom(
          http.get<string[]>('https://random-word-api.vercel.app/api?words=1')
        );

        const word = res[0];

        const translationRes = await lastValueFrom(
          http.get<any>(
            `https://api-free.deepl.com/v2/translate?auth_key=dbc5f054-b4f3-e6d4-b4ed-571ebc2f473c:fx&text=${word}&target_lang=DE`
          )
        );

        let translatedWord = translationRes.translations[0].text;

        if (translatedWord.includes('.')) {
          translatedWord = translatedWord.split('.')[0] || null;
        }
        if (
          translatedWord.includes('ß') ||
          translatedWord.includes('-') ||
          translatedWord.includes(' ')
        ) {
          continue; // Retry if conditions are met
        }
        if (translatedWord === null) {
          continue;
        } else {
          this.word = translatedWord;
          return;
        }
      } catch (error) {
        console.error('Error fetching word:', error);
        return null;
      }
    }
  }

  async showContinueGameOpt() {
    this.serverConstant.showContinueOption();
    this.serverConstant.hideHangman();

    const currentState: any = await lastValueFrom(this.currentGameInfo);

    currentState.players.map((player: any) => {
      if (player.id === this.sessionId) {
        this.username = player.name;
        console.log('this.username');
        console.log(this.username);
      }
    });
  }

  connectWebSocket() {
    this.ws = new WebSocket('http://localhost:3000');
    this.ws.onopen = () => {
      this.ws?.send(JSON.stringify({ sessionId: this.sessionId }));
      this.serverConstant.setWs(this.ws);
    };
    this.ws.onmessage = (res: any) => {
      const data: any = JSON.parse(res.data);
      if (data.type === 'playerJoin') {
        this.currentGameInfo.players = data.players;
        this.serverConstant.setgameInfo(this.currentGameInfo);
      }
      if (data.state) {
        if (data.end) {
          this.showContinueGameOpt();
        }
        if (data.addKey) {
          this.serverConstant.addKeytoState(data);
        } else {
          this.serverConstant.setgameInfo(data);
        }
      }
      if (data.message) {
        if (data.type === 'gameInfo') {
          if (data.end) {
            this.showContinueGameOpt();
          }
        }
        this.serverConstant.setMessage(data.message);
      }
      if (data.roomId) {
        this.roomId = data.roomId;
        this.serverConstant.setRoomId(this.roomId!);
        this.gameRoomEntered.emit(true);
        if (data.type === 'create') {
          this.usernameInput.control.setErrors({ invalid: true });
        }
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    this.ws.onclose = () => {
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    };
  }

  joinRoom() {
    if (!this.roomId) {
      return;
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.serverConstant.setRoomId(this.roomId!);
      this.ws.send(
        JSON.stringify({
          username: this.username,
          type: 'join',
          roomId: this.roomId,
          sessionId: this.sessionId,
        })
      );
    } else {
      console.error('WebSocket is not open. Attempting to reconnect...');
      this.connectWebSocket();
    }
  }

  createRoom() {
    if (this.word && this.username) {
      // Ensure the WebSocket is open before sending a message
      if (this.ws?.readyState === WebSocket.OPEN) {
        if (this.randomWordSelected) {
          this.ws?.send(
            JSON.stringify({
              type: 'create',
              username: this.username,
              word: this.word,
              sessionId: this.sessionId,
              randWord: true,
            })
          );
          this.serverConstant.setMessage('');
        } else if (!this.username || !this.word) {
          this.serverConstant.setMessage('Username and word are required!');
          return;
        } else {
          this.ws.send(
            JSON.stringify({
              type: 'create',
              username: this.username,
              word: this.word,
              sessionId: this.sessionId,
              randWord: false,
            })
          );
          this.serverConstant.setMessage('');
        }
      } else {
        console.error('WebSocket is not open. Attempting to reconnect...');
        this.connectWebSocket();
      }
    } else {
      this.serverConstant.setMessage(
        'Set a Username and a Hangman-Word first!'
      );
    }
  }

  continueGame() {
    this.serverConstant.hideContinueOption();
    console.log('this.randomWordSelected');
    console.log(this.randomWordSelected);
    if (!this.word) {
      this.serverConstant.setMessage('Username and word are required!');
      return;
    }
    this.ws?.send(
      JSON.stringify({
        type: 'continue',
        roomId: this.serverConstant.getRoomId(),
        word: this.word,
        sessionId: this.sessionId,
        randWord: this.randomWordSelected,
      })
    );
  }

  handleError(error: HttpErrorResponse) {
    return throwError(
      () =>
        new Error(
          'Something bad happened; please try again: ' + error.error.message
        )
    );
  }

  randomWordselection() {
    this.randomWordSelected = !this.randomWordSelected;
    this.http
      .get('https://random-word-api.vercel.app/api?words=1')
      .subscribe((res) => {
        const word = res as Array<string>;
        this.http
          .get(
            'https://api-free.deepl.com/v2/translate?auth_key=dbc5f054-b4f3-e6d4-b4ed-571ebc2f473c:fx&text=' +
              word[0] +
              '&target_lang=DE'
          )
          .subscribe((res: any) => {
            this.word = res.translations[0].text;
          });
      });
  }
}
