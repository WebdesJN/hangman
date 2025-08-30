import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ServerConstantsService } from '../services/server-constants.service';

@Component({
  selector: 'app-body',
  templateUrl: './body.component.html',
  styleUrls: ['./body.component.scss'],
})
export class BodyComponent implements OnInit, AfterViewInit, OnDestroy {
  constructor(private serverCont: ServerConstantsService) {}

  @ViewChild('hangmanParts') hangmanParts!: ElementRef<HTMLDivElement>;
  @ViewChild('success') success: null | ElementRef<HTMLDivElement> = null;
  @ViewChild('alphabet') alphabetHtml: null | ElementRef<HTMLElement> = null;
  fakeArray = Array();
  gameInfo!: {
    roomId: string;
    players: Array<any>;
    state: {
      keys: Array<string>;
      numbOfLettersWord: number;
      guessedLetters: Array<any>;
    };
  };
  alphabet: string = 'abcdefghijklmnopqrstuvwxyzäöü';
  alphabetArray: string[] = this.alphabet.split('');
  warn: string = '';
  loseMessage: string = '';
  winMessage: string = '';
  roomId: string | null = null;
  fails: number = 0;
  continueGame: boolean = false;

  async ngOnInit() {
    this.serverCont?.continueOption?.subscribe((continueOption) => {
      this.continueGame = continueOption;
    });

    this.serverCont?.currentmessage?.subscribe((msg) => {
      console.log(msg);
      this.winMessage = msg;
    });

    this.roomId = this.serverCont.getRoomId();

    this.serverCont?.currentGameInfo?.subscribe((info) => {
      if (this.fails === 6) {
        info.state.guessedLetters.map((letter: any) => {
          this.gameInfo?.state.guessedLetters.push(letter);
          this.loseMessage = info.message;
        });
        return;
      }
      if (info.roomId) {
        /*one Object hast all the game-Infos, it's sent when a player joins or refreshes the page. 
      the other Object is only info of a game action and contains the key and guessedLetters (if the key was a correct guess).
      so im asking for info.roomId to know if it's the Object with all infos or the other one.*/
        this.gameInfo = info;
        if (!this.gameInfo) {
          return;
        }
        const wordLength = info?.state.numbOfLettersWord;
        this.fakeArray = Array(wordLength);
      } else {
        this.gameInfo?.state.keys.push(info.state.keys);
        info.state.guessedLetters.map((letter: any) => {
          this.gameInfo?.state.guessedLetters.push(letter);
        });
      }
      if (!this.gameInfo) {
        return;
      }
      this.fails =
        this.gameInfo?.state?.keys?.length - this.countGuessedLetters();
      this.serverCont.setFails(this.fails);
      this.ngAfterViewInit();
    });

    this.serverCont?.showHangman?.subscribe((show) => {
      if (!show) {
        this.warn = '';
        this.loseMessage = '';
        this.winMessage = '';
        this.fails = 0;
        this.gameInfo.state.keys = [];
        this.hideHangman();
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.fails === 0) {
      return;
    } else {
      for (let i = 0; i <= this.fails - 1; i++) {
        this.revealHangman(i);
      }
    }
  }

  @HostListener('window:keydown', ['$event'])
  sendAction(event: KeyboardEvent) {
    if (this.gameInfo && !event.ctrlKey) {
      if (!this.gameInfo.state.keys.includes(event.key)) {
        if (this.alphabetArray.includes(event.key)) {
          if (this.continueGame) {
            return;
          }
          const key = event.key;
          this.serverCont.getWs()?.send(
            JSON.stringify({
              type: 'action',
              sessionId: this.serverCont.getSessionId(),
              roomId: this.roomId,
              key: key.toLocaleLowerCase(),
            })
          );
        }
      }
    }
  }

  sendActionMobile(key: string) {
    if (this.continueGame) {
      return;
    }
    if (!this.gameInfo.state.keys.includes(key)) {
      this.serverCont.getWs()?.send(
        JSON.stringify({
          type: 'action',
          sessionId: this.serverCont.getSessionId(),
          roomId: this.roomId,
          key: key.toLocaleLowerCase(),
        })
      );
    }
  }

  countGuessedLetters() {
    let count = 0;
    let lastLetter = null;
    this.gameInfo?.state?.guessedLetters?.map((letterInfo) => {
      const letter = letterInfo.key;
      if (lastLetter! !== letter) {
        count++;
        lastLetter = letter;
      }
    });
    return count;
  }

  revealHangman(count: number) {
    this.hangmanParts?.nativeElement.children[count].classList.remove('hidden');
  }

  hideHangman() {
    Array.from(this.hangmanParts?.nativeElement.children).forEach((element) => {
      element.classList.add('hidden');
    });
  }

  leave() {
    this.serverCont.getWs()!.close();
    window.location.reload();
  }

  ngOnDestroy(): void {
    this.serverCont.getWs()!.close();
  }
}
