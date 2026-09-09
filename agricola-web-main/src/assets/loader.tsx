import React from 'react';

type LoaderProps = {
  message?: string;
  fullScreen?: boolean;
  size?: number; // base size in px for svg width
  className?: string;
};

const Loader: React.FC<LoaderProps> = ({
  message = 'loading...',
  fullScreen = true,
  size = 70,
  className = ''
}) => {
  const letters = message.split('');
  return (
    <div
      className={`tea-loader ${fullScreen ? 'fullscreen' : ''} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="loader-inner">
        <svg
          width={size}
          viewBox="0 0 725 980"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <g clipPath="url(#clip0)">
            <g>
              <path id="steam1" d="M334 272.304C335.347 227.685 347.068 214.806 383 186C403.053 167.91 411.743 159.688 414.5 112.5" strokeLinecap="round" strokeLinejoin="round" />
              <path id="steam2" d="M217 251C218.958 185.665 235.993 166.806 288.218 124.626C317.363 98.1371 329.993 86.0973 334 17" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <path d="M697.86 473.399C681.01 457.699 663.21 450.999 637.94 450.999C620.32 450.999 606.73 454.259 591.41 461.909L582.03 466.699L583.18 462.099C585.1 454.249 588.73 359.289 587.58 350.669C586.82 345.499 584.52 340.709 581.45 337.839L576.47 333.249L296.75 332.869C142.82 332.689 14.93 333.259 12.82 334.219C10.52 334.979 6.88001 338.239 4.40001 341.299L0 346.659L1.34001 400.269C5.93001 611.059 50.35 800.219 120.23 906.669C137.27 932.709 170.77 966.789 186.86 974.639L198.16 979.999L296.76 978.849C407.42 977.319 399.19 978.469 419.48 961.999C457.58 930.599 496.44 860.909 524.21 773.989C529.57 757.139 535.5 742.589 538.76 738.189C547.57 726.129 565.18 714.449 605.58 694.149C660.53 666.389 679.48 653.179 696.9 630.199C715.09 606.079 724.28 577.359 724.28 544.429C724.28 512.269 716.24 490.819 697.86 473.399Z" />
            <g id="tea-bag">
              <path d="M422.734 531.212C419.674 521.062 411.244 511.112 400.334 504.792C390.374 498.862 379.464 498.092 350.744 500.962L335.044 502.682L334.084 496.172C333.504 492.722 330.444 473.002 327.194 452.522C324.134 432.032 318.574 402.552 315.134 386.852L308.814 358.712L267.654 358.722L270.514 368.682C278.174 395.292 294.634 485.852 294.634 501.742C294.634 507.672 294.444 507.672 282.764 509.012C248.304 512.652 235.664 517.432 225.714 531.222C215.184 545.962 214.994 551.712 222.844 619.102C226.674 652.222 230.694 682.662 231.654 686.492C236.244 704.102 257.304 720.572 275.304 720.572C289.284 720.572 396.874 707.742 406.074 704.872C416.984 701.812 432.684 686.112 435.944 675.382C437.351 670.327 438.123 665.117 438.244 659.872C438.244 647.622 425.224 539.442 422.734 531.212ZM396.884 664.482C395.354 666.972 392.674 668.882 390.754 668.882C389.034 668.882 362.614 671.942 331.974 675.392C295.214 679.802 275.304 681.332 273.194 680.182C268.794 677.882 268.794 678.272 262.094 618.722C255.584 561.472 255.394 554.972 258.844 552.672C261.714 550.952 356.484 539.272 371.424 538.882C378.114 538.692 382.904 539.652 384.244 540.992C385.204 542.332 389.224 569.712 392.864 601.872C398.994 653.752 399.374 660.842 396.884 664.482Z" />
            </g>
          </g>
          <defs>
            <clipPath id="clip0">
              <rect width="724.28" height="979.999" fill="white" />
            </clipPath>
          </defs>
        </svg>
        <div className="loading" aria-hidden="true">
          {letters.map((ch, i) => (
            <div key={i} className="loading-letter" style={{ animationDelay: `${i * 0.1}s` }}>
              {ch}
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@500&display=swap");
        .tea-loader {
          display: inline-flex;
          width: 100%;
        }
        .tea-loader.fullscreen {
          position: fixed;
          inset: 0;
          background: #ffe5d4;
          z-index: 9999;
          align-items: center;
          justify-content: center;
        }
        .tea-loader:not(.fullscreen) {
          align-items: center;
          justify-content: center;
        }
        .tea-loader .loader-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          font-family: 'Josefin Sans', sans-serif;
          text-align: center;
        }
        .tea-loader svg {
          fill: #084c61;
        }
        #steam1,#steam2 {
          fill: none;
          stroke: #084c61;
          stroke-width: 40;
        }
        #steam1 {
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: wave1 2s infinite;
        }
        #steam2 {
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: wave2 2s infinite;
        }
        #tea-bag {
          animation: bag 1s ease-in-out infinite alternate;
          transform-box: fill-box;
          transform-origin: top;
        }
        .loading {
          display: flex;
          flex-direction: row;
        }
        .loading-letter {
          font-size: 18px;
          font-weight: 500;
          color: #084c61;
          animation: bounce 2s infinite;
        }
        @keyframes wave1 {
          10% { stroke-dashoffset: 300; opacity: .4; }
          80% { stroke-dashoffset: 90; opacity: 0; }
          100% { stroke-dashoffset: 90; opacity: 0; }
        }
        @keyframes wave2 {
          0% { stroke-dashoffset: 920; opacity: .4; }
          100% { stroke-dashoffset: 250; opacity: 0; }
        }
        @keyframes bag {
          from { transform: rotateZ(-5deg); }
            to { transform: rotateZ(15deg); }
        }
        @keyframes bounce {
          0% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
          80%,100% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Loader;
