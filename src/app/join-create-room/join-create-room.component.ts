import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { NgForm } from '@angular/forms';
import { throwError } from 'rxjs';
import { ServerConstantsService } from '../services/server-constants.service';

@Component({
  selector: 'main[app-join-create-room]',
  templateUrl: './join-create-room.component.html',
  styleUrls: ['./join-create-room.component.scss'],
})
export class JoinCreateRoomComponent implements OnInit {
  currentGameInfo: any;
  currentMessage!: string;
  constructor(
    private http: HttpClient,
    private serverConstant: ServerConstantsService
  ) {}

  sessionId!: string;
  @ViewChild('form') form!: NgForm;
  @ViewChild('yusername') usernameInput!: NgForm;
  @Output() gameRoomEntered = new EventEmitter<boolean>();
  username: string | null = null;
  roomId: string | null = null;
  randomWordSelected: boolean = false;

  word: string | null = null;
  ws: WebSocket | null = null;
  httpHeaders = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
    }),
    withCredentials: true,
  };

  async ngOnInit() {
    // Establish WebSocket connection once
    this.sessionId = this.serverConstant.getSessionId();
    this.connectWebSocket();
    this.serverConstant.setWs(this.ws);
    this.serverConstant.currentGameInfo.subscribe((info) => {
      this.currentGameInfo = info;
    });

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

  connectWebSocket() {
    this.ws = new WebSocket('ws://localhost:3000');

    this.ws.onopen = () => {
      this.ws?.send(JSON.stringify({ sessionId: this.sessionId }));
    };
    this.ws.onmessage = (res: any) => {
      const data: any = JSON.parse(res.data);

      if (data.type === 'playerJoin') {
        this.currentGameInfo.players = data.players;
        this.serverConstant.setgameInfo(this.currentGameInfo);
      }
      if (data.state || data.key) {
        this.serverConstant.setgameInfo(data);
      }
      if (data.message) {
        this.currentMessage = data.message;
        if (data.type === 'gameInfo') {
          this.serverConstant.setMessage(data.message);
        }
      } else if (data.roomId) {
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
      }
    } else {
      console.error('WebSocket is not open. Attempting to reconnect...');
      this.connectWebSocket();
    }
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
