import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <app-popup-container [text]="'click here to show popup'">
      <label>
        input1
        <input type="text" [(ngModel)]="text1" id="input1"/>
      </label>
      <label>
        input2
        <input type="text" [(ngModel)]="text2" id="input2"/>
      </label>
    </app-popup-container>
    
    <div id="result1">text1 is: {{text1}}</div>
    <div id="result2">text2 is: {{text2}}</div>
  `,
  styles: [`
  
  `]
})
export class AppComponent {
  text1 = '';
  text2 = '';

}
