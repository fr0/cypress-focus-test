import {EventEmitter, Injectable, NgZone} from '@angular/core';
import {Subject} from 'rxjs';

/**
 * Values that can be specified for [[OverlayOptions.anchorPosition]].
 */
export type AnchorPositionType =
  'top left'    | 'top middle'    | 'top right' |
  'center left' | 'center middle' | 'center right' |
  'bottom left' | 'bottom middle' | 'bottom right' |
  'mouse' | 'mouseWithTracking';

/**
 * Values that can be specified for [[OverlayOptions.anchorAlign]].
 */
export type AnchorAlignType =
  'top left'    | 'top middle'    | 'top right' |
  'center left' | 'center middle' | 'center right' |
  'bottom left' | 'bottom middle' | 'bottom right';


type PositionalType = 'top' | 'left' | 'bottom' | 'right' | 'center' | 'middle' | 'mouse' | 'mouseWithTracking';

/**
 * Options that can be used when positioning an element via the [[Overlay]] class.
 */
export interface OverlayOptions {
  /**
   * CSS Selector indicating which element the popup will be anchored to.
   * If not present (undefined), the popup will be anchored to the originalParent.
   * The meaning of this depends on the value of [[anchorRelative]].
   */
  anchor?: string | HTMLElement;
  /**
   * Location of the popup relative to the anchor; e.g., "bottom left",
   * "bottom right", "top right", etc. Defaults to "bottom left". The special
   * values "mouse" and "mouseWithTracking" will position it at the mouse cursor.
   * Defaults to "bottom left".
   */
  anchorPosition?: AnchorPositionType;
  /**
   * Which edges of the popup to align with the anchor. Defaults to "top left".
   */
  anchorAlign?: AnchorAlignType;
  /**
   * See [[anchorPosition]]; this is used in conjunction with [[preventOverflow]] to
   * reposition the popup in case of overflow. Does nothing if [[preventOverflow]]
   * is not specified.
   */
  alternateAnchorPosition?: AnchorPositionType;
  /**
   * See [[anchorAlign]]; this is used in conjunction with [[preventOverflow]] to
   * reposition the popup in case of overflow. Does nothing if [[preventOverflow]]
   * is not specified.
   */
  alternateAnchorAlign?: AnchorAlignType;
  /**
   * If specified, will offset the location of the popup in the x-coordinate by
   * the given number of pixels.
   */
  anchorOffsetX?: number | Function;
  /**
   * If specified, will offset the location of the popup in the y-coordinate by
   * the given number of pixels.
   */
  anchorOffsetY?: number | Function;
  /**
   * If true, the [[anchor]] selector will be interpreted as relative
   * to original parent DOM element. Otherwise, it will be global.
   * Also affects [[minWidthAnchor]] and [[minHeightAnchor]], if they
   * are present and are CSS selectors.
   */
  anchorRelative?: boolean;
  /**
   * Options are undefined, "width", "height", or "both". Indicates
   * which axes (if any) will be bounded to prevent the popup from overflowing off
   * the edge of the browser window.
   */
  restrictSize?: 'width' | 'height' | 'both';
  /**
   * Options are undefined, "x", "y", or "both". Indicates along which
   * axes (if any) the popup will be shifted to prevent the it from overflowing
   * off the edge of the browser window.
   */
  preventOverflow?: 'x' | 'y' | 'both';

  /**
   * CSS selector or element. If present, the width of the given element will be
   * used as the min-width of the popup.
   */
  minWidthAnchor?: string | HTMLElement;

  /**
   * CSS selector or element. If present, the height of the given element will be
   * used as the min-height of the popup.
   */
  minHeightAnchor?: string | HTMLElement;

  /**
   * If the popup is truncated due to width, apply this padding as well.
   */
  xPadding?: number;
  /**
   * If the popup is truncated due to height, apply this padding as well.
   */
  yPadding?: number;

  /**
   * If > 0, then the positioning algorithm will not run every frame.
   * This improves performance.
   */
  skipFrames?: number;

  /**
   * Is the overlay algorithm responsible for positioning the element?
   */
  assignPosition?: boolean;
}

function isEmpty(rect: ClientRect) {
  return rect.left === 0 && rect.top === 0 &&
    rect.width === 0 && rect.height === 0;
}

/**
 * Service that provides a low-level API for managing overlay elements, such as popups, tooltips, or dialogs.
 * Call [[positionOverlay]] to begin positioning your element.
 */
@Injectable({providedIn: 'root'})
export class Overlay {
  constructor(private ngZone: NgZone) {
    ngZone.runOutsideAngular(() => {
      document.addEventListener('mousemove', ev => this.globalMouseMove(ev));
    });
  }

  private _mouseX: number = 0;
  private _mouseY: number = 0;
  private mouseOverride = new Subject<{x:number, y:number}>();

  private readonly forceUpdateRquested: EventEmitter<any> = new EventEmitter<any>();
  forceUpdate() {
    this.forceUpdateRquested.emit();
  }

  /**
   * Gets the current mouse X coordinate, in client space.
   */
  get mouseX(): number { return this._mouseX; }

  /**
   * Gets the current mouse Y coordinate, in client space.
   */
  get mouseY(): number { return this._mouseY; }

  /**
   * Used to update the mouse position outside of the normal document mousemove handler.
   * For example, during drag/drop operations, mousemove doesn't fire on the document.
   * @param x The clientX coordinate
   * @param y The clientY coordinate
   */
  overrideMousePosition(x: number, y: number): void {
    this._mouseX = x;
    this._mouseY = y;
    this.mouseOverride.next({x,y});
  }

  private globalMouseMove(event: MouseEvent) {
    this._mouseX = event.clientX;
    this._mouseY = event.clientY;
  }

  /**
   * Keeps the given element positioned to an anchor element according to the options.
   * Your element should have a style containing `position: fixed;`, which you are responsible for setting.
   * @param element The element being positioned.
   * @param originalParent The parent element, which is used as the default anchor.
   * Usually, you can just pass in element.parentElement.
   * Occasionally you might want to explicitly specify the default anchor element.
   * @param options A set of options that controls the overlay.
   * @returns An unhook function. Call this when you no longer need the positioning.
   */
  positionOverlay(element: HTMLElement, originalParent: HTMLElement, options: OverlayOptions): Function {
    function positionIs(pos: PositionalType[], check: PositionalType) {
      return pos.indexOf(check) >= 0;
    }
    function makePosition(a: AnchorPositionType | AnchorAlignType): PositionalType[] {
      return <PositionalType[]> a.split(' ');
    }
    function queryForElement(ele: string | HTMLElement) {
      if (typeof ele === 'string') {
        if (options.anchorRelative) {
          return <HTMLElement> originalParent.querySelector(<string>ele);
        }
        else {
          return <HTMLElement> document.querySelector(<string>ele);
        }
      }
      return <HTMLElement>ele;
    }

    let anchor = originalParent;
    const anchorPosition = makePosition(options.anchorPosition || 'bottom left');
    const anchorAlign = makePosition(options.anchorAlign || 'top left');
    let alternateAnchorPosition = anchorPosition;
    let alternateAnchorAlign = anchorAlign;
    if (options.alternateAnchorPosition) {
      alternateAnchorPosition = makePosition(options.alternateAnchorPosition);
    }
    if (options.alternateAnchorAlign) {
      alternateAnchorAlign = makePosition(options.alternateAnchorAlign);
    }
    const anchorOffset = {x: options.anchorOffsetX || 0, y: options.anchorOffsetY || 0};
    if (options.anchor) {
      anchor = queryForElement(options.anchor);
    }

    let mouseX = this.mouseX, mouseY = this.mouseY;

    function updateMousePosition(event) {
      mouseX = event.clientX;
      mouseY = event.clientY;
    }

    function evaluate(v: number | Function): number {
      if (typeof v === 'function') {
        return v();
      }
      return v;
    }

    // http://meyerweb.com/eric/thoughts/2011/09/12/un-fixing-fixed-elements-with-css-transforms/
    function getContainingBlock(ele: Element) {
      let parent = ele.parentElement;
      while (parent && !parent.matches('body')) {
        const style = window.getComputedStyle(parent);
        const transform = style.getPropertyValue('transform');
        if (transform && transform !== 'none') {
          return parent;
        }
        parent = parent.parentElement;
      }
      return undefined;
    }

    function evaluateX(position: PositionalType[], align: PositionalType[], anchorRect: ClientRect, elementRect: ClientRect, minWidth: number) {
      let x: number;
      if (positionIs(position, 'mouse') || positionIs(position, 'mouseWithTracking')) {
        x = mouseX;
      }
      else {
        x = anchorRect.left;
        if (positionIs(position, 'middle')) {
          x += anchorRect.width / 2;
        }
        else if (positionIs(position, 'right')) {
          x += anchorRect.width;
        }
      }
      if (positionIs(position, 'middle')) {
        x -= Math.max(minWidth, elementRect.width) / 2;
      }
      else if (positionIs(align, 'right')) {
        x -= Math.max(minWidth, elementRect.width);
      }
      if (anchorOffset.x) {
        x += evaluate(anchorOffset.x);
      }
      return x;
    }

    function evaluateY(position: PositionalType[], align: PositionalType[], anchorRect: ClientRect, elementRect: ClientRect, minHeight: number) {
      let y: number;
      if (positionIs(position, 'mouse') || positionIs(position, 'mouseWithTracking')) {
        y = mouseY;
      }
      else {
        y = anchorRect.top;
        if (positionIs(position, 'center')) {
          y += anchorRect.height / 2;
        }
        else if (positionIs(position, 'bottom')) {
          y += anchorRect.height;
        }
      }
      if (positionIs(align, 'center')) {
        y -= Math.max(minHeight, elementRect.height) / 2;
      }
      else if (positionIs(align, 'bottom')) {
        y -= Math.max(minHeight, elementRect.height);
      }
      if (anchorOffset.y) {
        y += evaluate(anchorOffset.y);
      }
      return y;
    }

    let subscription = undefined;
    if (positionIs(anchorPosition, 'mouseWithTracking')) {
      document.addEventListener('mouseenter', updateMousePosition);
      document.addEventListener('mousemove', updateMousePosition);
      subscription = this.mouseOverride.subscribe(pos => {
        mouseX = this.mouseX;
        mouseY = this.mouseY;
      });
    }

    let running = true;
    let skipFrameCount = 0; // always run the first frame

    const update = () => {
      if (!running) {
        return;
      }
      if (skipFrameCount) {
        skipFrameCount--;
        requestAnimationFrame(() => update());
        return;
      }
      skipFrameCount = options.skipFrames;

      let anchorRect = anchor.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      if (anchor.matches('html')) {
        anchorRect = {top: 0, left: 0, width: window.innerWidth, height: window.innerHeight,
          right: window.innerWidth, bottom: window.innerHeight};
      }

      let minWidth = 0;
      let minHeight = 0;
      if (options.minWidthAnchor) {
        const e = queryForElement(options.minWidthAnchor);
        if (e) {
          const rect = e.getBoundingClientRect();
          minWidth = rect.width;
        }
      }
      if (options.minHeightAnchor) {
        const e = queryForElement(options.minHeightAnchor);
        if (e) {
          const rect = e.getBoundingClientRect();
          minHeight = rect.height;
        }
      }

      let x = evaluateX(anchorPosition, anchorAlign, anchorRect, elementRect, minWidth);
      let y = evaluateY(anchorPosition, anchorAlign, anchorRect, elementRect, minHeight);

      let boundedWidth, boundedHeight;
      const containerX = 0, containerY = 0;
      boundedWidth = window.innerWidth;
      boundedHeight = window.innerHeight;
      const availableWidth = boundedWidth - (options.xPadding || 0);
      const availableHeight = boundedHeight - (options.yPadding || 0);

      // restrict-size will shrink the popup if it flows over the edge of the window
      let maxWidth: number;
      let maxHeight: number;
      if (options.restrictSize === 'both' || options.restrictSize === 'height') {
        maxHeight = availableHeight;
        if (options.preventOverflow !== 'both' && options.preventOverflow !== 'y') {
          maxHeight -= elementRect.top;
        }
      }
      if (options.restrictSize === 'both' || options.restrictSize === 'width') {
        maxWidth = availableWidth;
        if (options.preventOverflow !== 'both' && options.preventOverflow !== 'x') {
          maxWidth -= elementRect.left;
        }
      }
      // prevent-overflow will move the popup if it flows over the edge of the window
      const expectedHeight = Math.min(elementRect.height, maxHeight||Infinity);
      const expectedWidth = Math.min(elementRect.width, maxWidth||Infinity);
      if (options.preventOverflow === 'both' || options.preventOverflow === 'y') {
        const dyBottom = Math.max(0, (y + expectedHeight) - availableHeight);
        const dyTop = Math.min(0, y);
        if (dyBottom > 0 || dyTop < 0) {
          y = evaluateY(alternateAnchorPosition, alternateAnchorAlign, anchorRect, elementRect, minHeight);
        }
        y = y - Math.max(0, (y + expectedHeight) - availableHeight) - Math.min(0, y);
        if (y < containerY) {
          y = containerY;
        }
      }
      if (options.preventOverflow === 'both' || options.preventOverflow === 'x') {
        const dxRight = Math.max(0, (x + expectedWidth) - availableWidth);
        const dxLeft = Math.min(0, x);
        if (dxRight > 0 || dxLeft < 0) {
          x = evaluateX(alternateAnchorPosition, alternateAnchorAlign, anchorRect, elementRect, minWidth);
        }
        x = x - Math.max(0, (x + expectedWidth) - availableWidth) - Math.min(0, x);
        if (x < containerX) {
          x = containerX;
        }
      }

      const block = getContainingBlock(element);
      if (block) {
        const blockRect = block.getBoundingClientRect();
        y -= blockRect.top;
        x -= blockRect.left;
      }

      if (options.assignPosition === undefined || options.assignPosition) {
        element.style.top = y + 'px';
        element.style.left = x + 'px';
      }
      if (isEmpty(anchorRect)) {
        element.style.display = 'none';
      }
      else  {
        element.style.removeProperty('display');
      }

      if (maxWidth !== undefined) {
        element.style.maxWidth = `${maxWidth}px`;
      }
      if (maxHeight !== undefined) {
        element.style.maxHeight = `${maxHeight}px`;
      }
      if (minWidth > 0) {
        element.style.minWidth = `${minWidth}px`;
      }
      else {
        element.style.minWidth = '';
      }
      if (minHeight > 0) {
        element.style.minHeight = `${minHeight}px`;
      }
      else {
        element.style.minHeight = '';
      }

      requestAnimationFrame(() => update());
    };

    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        if (running) {
          update();
        }
      });
    });

    const forceUpdateSubscription = this.forceUpdateRquested.subscribe(() => update());

    function unhook() {
      running = false;
      if (positionIs(anchorPosition, 'mouseWithTracking')) {
        document.removeEventListener('mouseenter', updateMousePosition);
        document.removeEventListener('mousemove', updateMousePosition);
        subscription.unsubscribe();
      }

      forceUpdateSubscription.unsubscribe();
    }
    return unhook;
  }

  /**
   * Returns an [[AnchorAlignType]] that is the opposite of the given position
   * in the Y axis, and the same in the X axis.
   * @param position The original align type
   * @returns The mirrored align type
   */
  static mirrorY(position: AnchorAlignType): AnchorAlignType {
    switch (position) {
      case 'top left':
        return 'bottom left';
      case 'bottom left':
        return 'top left';
      case 'top right':
        return 'bottom right';
      case 'bottom right':
        return 'top right';
      case 'bottom middle':
        return 'top middle';
      case 'top middle':
        return 'bottom middle';
      default:
        return position;
    }
  }
}
