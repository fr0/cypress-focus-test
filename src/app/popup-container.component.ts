import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {Overlay} from './overlay';

@Component({
  selector: 'app-popup-container',
  template: `
    <button class="expand" (click)="clickButton($event)" #button>
      <div>{{text}}</div>
    </button>
    <div class="content" [class.showing]="showContent" #content>
      <ng-container *ngIf="showContent">
        <ng-content></ng-content>
      </ng-container>
    </div>
  `,
  styles: [`
    .expand {
      background: white;
      border: 1px solid #a5a5a5;
      padding: 1px;
    }
    .content {
      display: none;
      position: fixed;
      background: white;
      padding: 8px;
      border: 1px solid #bfbfbf;
      z-index: 999;
    }
    .content.showing {
      display: block;
    }
  `]
})
export class PopupContainerComponent implements OnChanges, OnDestroy {
  @Input() text: any;
  @Input() autofocus = false;
  showingPopup = false;
  unhook: Function;
  @ViewChild('content', {read: ElementRef, static: true}) content: ElementRef<HTMLElement>;
  @ViewChild('button', {read: ElementRef, static: false}) button: ElementRef<HTMLElement>;

  constructor(private overlay: Overlay,
              private hostElement: ElementRef<HTMLElement>,
              private changeDetector: ChangeDetectorRef) {
    hostElement.nativeElement.setAttribute('tabindex', '0');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.autofocus && this.autofocus) {
      setTimeout(() => {
        this.hostElement.nativeElement.focus();
        this.showPopup();
      });
    }
  }
  ngOnDestroy() {
    if (this.unhook) {
      this.unhook();
      this.unhook = undefined;
    }
  }

  get showContent(): boolean {
    return this.showingPopup;
  }

  clickButton(event: Event) {
    this.showPopup();
    event.stopPropagation();
    event.preventDefault();
  }

  hidePopup() {
    if (!this.showingPopup) { return; }
    this.showingPopup = false;
    if (this.unhook) {
      this.unhook();
      this.unhook = undefined;
    }
    this.changeDetector.markForCheck();
  }
  showPopup() {
    if (this.showingPopup) { return; }
    this.showingPopup = true;
    this.unhook = this.overlay.positionOverlay(this.content.nativeElement, this.button.nativeElement, {
      anchorAlign: 'top left',
      anchorPosition: 'bottom left',
      anchorOffsetY: -1,
      preventOverflow: 'both',
      restrictSize: 'both'
    });
    this.changeDetector.markForCheck();
  }

  private isRelatedTarget(rt: Node) {
    if (!rt || !(rt instanceof HTMLElement)) {
      return false;
    }
    const element = <HTMLElement>rt;
    return this.hostElement.nativeElement.contains(element);
  }

  @HostListener('focus', ['$event'])
  gotFocus(event: FocusEvent) {
    setTimeout(() => {
      if (this.autofocus && this.content && this.button) {
        this.showPopup();
      }
    });
  }

  @HostListener('focusout', ['$event'])
  onFocusOut(event: FocusEvent) {
    if (!this.isRelatedTarget(<Node>event.relatedTarget)) {
      this.hidePopup();
    }
  }

  @HostListener('window:keydown.escape', ['$event']) onEscapeKeyDown(event: KeyboardEvent) {
    this.hidePopup();
  }
}
