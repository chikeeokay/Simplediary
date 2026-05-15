/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Calendar, Trash2, Clock, Plus, Loader2, Save, AlertTriangle, LogOut, Camera } from 'lucide-react';
import { format, isSameDay, parseISO, addHours, areIntervalsOverlapping, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toBlob } from 'html-to-image';
import { Lunar } from 'lunar-javascript';

const getDayStemBranch = (date: Date) => {
  return Lunar.fromDate(date).getDayInGanZhiExact();
};

const getMonthStemBranch = (date: Date) => {
  return Lunar.fromDate(date).getMonthInGanZhiExact();
};

const getYearStemBranch = (date: Date) => {
  return Lunar.fromDate(date).getYearInGanZhiExact();
};

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  isHoliday?: boolean;
}

const PREDEFINED_ACTIVITIES = [
  "回家食飯 🍚",
  "陪女朋友 ❤️",
  "做運動 🏃‍♂️",
  "打機 🎮",
  "睇戲 🍿",
  "返工 💻",
  "買餸 🛒",
  "溫書 📚",
  "打麻雀 🀄",
  "玩桌遊 🎲",
  "睇醫生 🏥",
  "放空Hea ☁️"
];

function TimelineGrid({ 
  containerId, 
  currentMonth, 
  daysInMonth, 
  groupedEvents, 
  handleDelete, 
  prevMonth, 
  nextMonth, 
  todayAtMidnight,
  isExport = false,
  isExportBlank = false,
  exportRatio,
  hideStemBranch = false,
  hideEvents = false,
  enlargeExportStemBranch = false,
  shrinkExportShift = false,
  shifts = {},
  toggleShift,
  clickedDate,
  onDateClick,
  onDateDoubleClick,
  onEventClick
}: {
  containerId: string;
  currentMonth: Date;
  daysInMonth: Date[];
  groupedEvents: Record<string, CalendarEvent[]>;
  handleDelete: (event: CalendarEvent) => void;
  prevMonth: () => void;
  nextMonth: () => void;
  todayAtMidnight: Date;
  isExport?: boolean;
  isExportBlank?: boolean;
  exportRatio?: '16:9' | '4:3' | '1:1';
  hideStemBranch?: boolean;
  hideEvents?: boolean;
  enlargeExportStemBranch?: boolean;
  shrinkExportShift?: boolean;
  shifts?: Record<string, 'D' | 'N'>;
  toggleShift?: (dateStr: string, e: React.MouseEvent) => void;
  clickedDate?: Date | null;
  onDateClick?: (date: Date) => void;
  onDateDoubleClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}) {
  return (
    <div id={containerId} className={`bg-[#fdf2f8] rounded-2xl ${isExport ? 'p-6 xl:p-8 flex flex-col' : 'p-1.5 sm:p-4 w-full'}`} style={isExport ? { 
      width: exportRatio === '16:9' ? '2400px' : '1800px', 
      height: exportRatio === '1:1' ? '1800px' : '1350px',
      minHeight: exportRatio === '1:1' ? '1800px' : '1350px',
      minWidth: exportRatio === '16:9' ? '2400px' : '1800px', 
      maxWidth: 'none' 
    } : {}}>
      <div className="flex items-center justify-between xl:mx-10 mb-2 sm:mb-4">
        <button data-export-ignore="true" onClick={prevMonth} className="cartoon-border px-4 py-2 font-black bg-white hover:bg-gray-50">{"<"}</button>
        <div className="flex-1 flex justify-center">
          <h3 style={{ paddingLeft: '18px', paddingTop: '-5px', paddingBottom: '-13px' }} className="text-[19px] sm:text-3xl font-black text-center px-2 py-1 sm:px-6 sm:py-2 border border-black rounded-2xl bg-[#E8C382] text-black leading-tight sm:leading-normal">
            {(() => {
              const chineseYear = Lunar.fromDate(currentMonth).getYearInGanZhiExact() + '年';
              return hideStemBranch ? format(currentMonth, 'yyyy年M月') : `${format(currentMonth, 'yyyy年M月')} ${chineseYear}`;
            })()}
          </h3>
        </div>
        <button data-export-ignore="true" onClick={nextMonth} className="cartoon-border px-4 py-2 font-black bg-white hover:bg-gray-50">{">"}</button>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
        {['日', '一', '二', '三', '四', '五', '六'].map((d, idx) => (
          <div key={d} className={`text-center font-black text-xl sm:text-3xl py-0 sm:py-0.5 leading-tight sm:leading-tight border border-black rounded-xl bg-[#FFD700] ${idx === 0 ? 'text-[#FF6B6B]' : 'text-black'}`}>{d}</div>
        ))}
      </div>
      <div 
        className={`grid grid-cols-7 gap-1 sm:gap-2 ${isExport && exportRatio ? 'flex-1 min-h-0' : ''}`}
        style={isExport && exportRatio ? { gridTemplateRows: `repeat(${daysInMonth.length / 7}, minmax(0, 1fr))` } : {}}
      >
        {daysInMonth.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const rawDayEvents = [...(groupedEvents[dateStr] || [])];
          
          const lunar = Lunar.fromDate(day);
          const lunarMonth = lunar.getMonth();
          const lunarDay = lunar.getDay();

          const dayEvents = (isExportBlank || hideEvents) ? rawDayEvents.filter(ev => ev.isHoliday) : rawDayEvents;
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const today = isSameDay(day, new Date());
          const isClicked = clickedDate ? isSameDay(day, clickedDate) : false;
          
          const colIndex = i % 7;
          const rowIndex = Math.floor(i / 7);
          const totalRows = Math.ceil(daysInMonth.length / 7);
          const hasHoliday = dayEvents.some(e => e.isHoliday);
          
          let originClass = 'origin-center';
          if (rowIndex === 0) {
            if (colIndex <= 1) originClass = 'origin-top-left';
            else if (colIndex >= 5) originClass = 'origin-top-right';
            else originClass = 'origin-top';
          } else if (rowIndex === totalRows - 1) {
            if (colIndex <= 1) originClass = 'origin-bottom-left';
            else if (colIndex >= 5) originClass = 'origin-bottom-right';
            else originClass = 'origin-bottom';
          } else {
            if (colIndex <= 1) originClass = 'origin-left';
            else if (colIndex >= 5) originClass = 'origin-right';
            else originClass = 'origin-center';
          }

          const shouldScale = isCurrentMonth && dayEvents.length > 0 && !isExport;

          let cellBorderClass = isCurrentMonth ? 'bg-white border-black rounded-lg' : 'bg-transparent border-gray-300 rounded-lg opacity-60';
          // 假期或星日特別框框
          if (isCurrentMonth && (hasHoliday || colIndex === 0)) {
            cellBorderClass = 'bg-[#fff5f5] border-[#CC0000] rounded-lg';
          }

          let dateTextColor = 'text-gray-700';
          if (today && !isExport) {
            dateTextColor = 'text-cartoon-primary';
          } else if (colIndex === 0 || hasHoliday) {
            dateTextColor = 'text-[#CC0000]'; // Dark Red instead of #FF6B6B
          }

          let hoverPosition = '';
          if (shouldScale && !isExport) {
            let xPos = '';
            if (colIndex <= 2) {
              xPos = `group-hover:-left-[10px] group-hover:-right-[80px] sm:group-hover:-left-[20px] sm:group-hover:-right-[180px] group-focus-within:-left-[10px] group-focus-within:-right-[80px] sm:group-focus-within:-left-[20px] sm:group-focus-within:-right-[180px] ${isClicked ? '-left-[10px] -right-[80px] sm:-left-[20px] sm:-right-[180px]' : ''}`;
            } 
            else if (colIndex >= 4) {
              xPos = `group-hover:-right-[10px] group-hover:-left-[80px] sm:group-hover:-right-[20px] sm:group-hover:-left-[180px] group-focus-within:-right-[10px] group-focus-within:-left-[80px] sm:group-focus-within:-right-[20px] sm:group-focus-within:-left-[180px] ${isClicked ? '-right-[10px] -left-[80px] sm:-right-[20px] sm:-left-[180px]' : ''}`;
            } 
            else {
              xPos = `group-hover:-left-[50px] group-hover:-right-[50px] sm:group-hover:-left-[100px] sm:group-hover:-right-[100px] group-focus-within:-left-[50px] group-focus-within:-right-[50px] sm:group-focus-within:-left-[100px] sm:group-focus-within:-right-[100px] ${isClicked ? '-left-[50px] -right-[50px] sm:-left-[100px] sm:-right-[100px]' : ''}`;
            }

            let yPos = `group-hover:min-h-full group-hover:h-max group-focus-within:min-h-full group-focus-within:h-max ${isClicked ? 'min-h-full h-max' : ''}`;
            if (rowIndex === totalRows - 1) {
              yPos += ` group-hover:bottom-0 group-hover:top-auto group-hover:-mb-[10px] group-focus-within:bottom-0 group-focus-within:top-auto group-focus-within:-mb-[10px] ${isClicked ? 'bottom-0 top-auto -mb-[10px]' : ''}`;
            } else {
              yPos += ` group-hover:-top-[10px] group-hover:bottom-auto group-focus-within:-top-[10px] group-focus-within:bottom-auto ${isClicked ? '-top-[10px] bottom-auto' : ''}`;
            }

            hoverPosition = `${xPos} ${yPos} group-hover:absolute group-hover:w-auto group-hover:h-auto group-focus-within:absolute group-focus-within:w-auto group-focus-within:h-auto ${isClicked ? 'absolute w-auto h-auto' : ''}`;
          }

          return (
            <div 
              key={dateStr} 
              className={`relative rounded-lg group ${isExport ? 'h-full flex flex-col min-h-0' : 'min-h-[60px] sm:min-h-[80px] md:min-h-[100px] xl:min-h-[120px] 2xl:min-h-[140px] h-full flex flex-col'} ${isExport ? '' : 'z-10'} ${isExport ? '' : 'hover:z-50 focus:z-50 focus-within:z-50 active:z-50 [&:focus-within]:z-50 [&:hover]:z-50'}`}
              style={{ zIndex: !isExport && isClicked ? 999 : undefined }}
              tabIndex={0}
              onClick={() => onDateClick?.(day)}
              onDoubleClick={(e) => {
                e.preventDefault();
                // Disable double-click to add on mobile devices to prevent interference with click/delete
                if (window.innerWidth >= 1024) {
                   onDateDoubleClick?.(day);
                }
              }}
            >
              {!isExport && (
                <div className="invisible pointer-events-none w-full flex flex-col p-0.5 sm:p-1 md:p-1.5 lg:p-1 xl:p-1.5 2xl:p-2 opacity-0" aria-hidden="true" style={{ position: 'relative' }}>
                  <div className={`relative flex ${hideStemBranch ? 'justify-start' : 'justify-between'} items-start mb-0 sm:mb-0.5 xl:mb-1 px-[1px] sm:px-0 flex-shrink-0 leading-none w-full min-w-0`}>
                    {!hideStemBranch && (
                      <div className={`flex ${isExport && isExportBlank && enlargeExportStemBranch ? 'gap-1' : (isExport ? 'gap-0.5' : 'gap-0 md:gap-[1px] xl:gap-0.5 2xl:gap-1')} ${isExport ? (isExportBlank ? (enlargeExportStemBranch ? 'text-[32px] pt-1 pl-1' : 'text-[20px] pt-1 pl-1') : 'text-[16px] pt-1 pl-1') : 'text-[8px] sm:text-[9.5px] md:text-[11px] lg:text-[10px] xl:text-[12px] 2xl:text-[14px] pt-0'} font-bold opacity-0`}>
                        <span className="flex flex-col leading-[1.05] tracking-tighter w-min"><span>年</span><span>月</span></span>
                        <span className="flex flex-col leading-[1.05] tracking-tighter w-min"><span>月</span><span>日</span></span>
                        <span className="flex flex-col leading-[1.05] tracking-tighter w-min"><span>日</span><span>日</span></span>
                      </div>
                    )}
                    <span className={`font-black text-transparent leading-none text-right ${isExport ? (isExportBlank ? 'text-[56px] pr-2 pt-0' : 'text-[28px] pr-1 pt-1') : 'text-[13px] sm:text-[15px] md:text-[17px] lg:text-[16px] xl:text-[18px] 2xl:text-[24px] pr-0 ml-0.5'} ${hideStemBranch ? 'w-full text-left pl-2 ml-0' : ''}`}>{format(day, 'd')}</span>
                  </div>
                  <div className={`grid min-h-0 gap-1 flex-1 content-start ${(toggleShift || shifts?.[dateStr]) ? 'pb-[32px] sm:pb-[36px]' : ''} grid-cols-1`}>
                    {dayEvents.map(event => {
                      const isAllDay = !event.start?.dateTime && event.start?.date;
                      let timeDisplay = '';
                      if (!isAllDay && event.start?.dateTime) {
                        const d = new Date(event.start.dateTime);
                        const h = d.getHours();
                        const m = d.getMinutes();
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        const hour12 = h % 12 || 12;
                        timeDisplay = m === 0 ? `${hour12}${ampm} ` : `${hour12}:${m.toString().padStart(2, '0')}${ampm} `;
                      }
                      let displaySummary = event.summary;
                      return (
                        <div key={`ph-${event.id}`} className="flex-shrink-0 h-max w-full">
                          <div className={`w-full border border-transparent rounded text-[8.5px] sm:text-[10px] md:text-[11px] lg:text-[12px] xl:text-[14px] 2xl:text-[16px] px-[1px] md:px-[2px] lg:px-[4px] py-[2px] sm:px-1 sm:py-0.5 lg:py-[4px] leading-[1.1] sm:leading-[1.15] whitespace-pre-wrap flex flex-col font-normal tracking-tight`}>
                            <div className="line-clamp-none break-all leading-tight">
                              {timeDisplay && <div className="opacity-90 font-sans whitespace-nowrap pb-0.5">{timeDisplay}</div>}
                              <div>{displaySummary}</div>
                            </div>
                            {event.description && (
                              <div className={`block mt-0.5 text-[8.5px] sm:text-[9.5px] md:text-[10px] lg:text-[11px] xl:text-[12px] 2xl:text-[14px] line-clamp-none leading-tight whitespace-pre-wrap`}>{event.description}</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div 
                className={`${isExport ? 'flex-1 h-full overflow-hidden' : 'absolute inset-0'} p-0.5 sm:p-1 md:p-1.5 lg:p-1 xl:p-1.5 2xl:p-2 border ${cellBorderClass} ${today && !isExport ? 'ring-4 ring-cartoon-accent' : ''} rounded-lg flex flex-col cursor-pointer transition-all duration-200 ease-out bg-white ${shouldScale && !isExport ? `group-focus-within:shadow-xl group-focus-within:border-black group-hover:shadow-xl group-hover:border-[2px] group-hover:border-black ${isClicked ? 'shadow-2xl border-[2px] border-black' : ''} ${hoverPosition}` : 'group-hover:bg-gray-50 group-focus-within:bg-gray-50'} z-20 overflow-hidden group-hover:overflow-visible group-focus-within:overflow-visible ${isClicked ? 'overflow-visible' : ''}`}
              >
                <div className={`relative flex ${hideStemBranch ? 'justify-start' : 'justify-between'} items-start mb-0 sm:mb-0.5 xl:mb-1 px-[1px] sm:px-0 flex-shrink-0 leading-none ${dateTextColor} w-full min-w-0`}>
                  {!hideStemBranch && (
                    <div className={`flex ${isExport && isExportBlank && enlargeExportStemBranch ? 'gap-1' : (isExport ? 'gap-0.5' : 'gap-0 md:gap-[1px] xl:gap-0.5 2xl:gap-1')} ${isExport ? (isExportBlank ? (enlargeExportStemBranch ? 'text-[32px] pt-1 pl-1' : 'text-[20px] pt-1 pl-1') : 'text-[16px] pt-1 pl-1') : 'text-[6.5px] sm:text-[8px] md:text-[10px] lg:text-[10px] xl:text-[12px] 2xl:text-[14px] pt-[1px]'} font-bold text-gray-400 sm:text-gray-500 opacity-90`}>
                      <span className="flex flex-col leading-[1.05] tracking-tighter w-min"><span key="y-0">{getYearStemBranch(day)[0]}</span><span key="y-1">{getYearStemBranch(day)[1]}</span></span>
                      <span className="flex flex-col leading-[1.05] tracking-tighter w-min"><span key="m-0">{getMonthStemBranch(day)[0]}</span><span key="m-1">{getMonthStemBranch(day)[1]}</span></span>
                      <span className="flex flex-col leading-[1.05] tracking-tighter w-min"><span key="d-0">{getDayStemBranch(day)[0]}</span><span key="d-1">{getDayStemBranch(day)[1]}</span></span>
                    </div>
                  )}
                  <span className={`relative z-10 font-black leading-none text-right tracking-tighter ${isExport ? (isExportBlank ? 'text-[56px] pr-2 pt-0' : 'text-[28px] pr-1 pt-1') : 'text-[11px] sm:text-[13px] md:text-[17px] lg:text-[16px] xl:text-[18px] 2xl:text-[24px] pr-0 ml-0.5'} ${hideStemBranch ? 'w-full text-left pl-2 ml-0' : ''}`}>{format(day, 'd')}</span>
                </div>
                <div className={`grid min-h-0 gap-1 flex-1 ${shouldScale && !isExport ? `group-hover:overflow-y-visible group-focus-within:overflow-y-visible ${isClicked ? 'overflow-y-visible' : 'overflow-y-auto'}` : 'overflow-y-auto'} no-scrollbar content-start px-1.5 -mx-1.5 pt-1.5 -mt-1.5 ${(toggleShift || shifts?.[dateStr]) ? (isExport ? (isExportBlank ? (shrinkExportShift ? 'pb-[84px]' : 'pb-[40px]') : 'pb-[40px]') : 'pb-[32px] sm:pb-[36px]') : ''} ${shouldScale && !isExport ? `grid-cols-1 ${dayEvents.length > 1 ? `group-hover:grid-cols-2 group-focus-within:grid-cols-2 ${isClicked ? 'grid-cols-2' : ''}` : `group-hover:grid-cols-1 group-focus-within:grid-cols-1 ${isClicked ? 'grid-cols-1' : ''}`}` : (isExport && ((exportRatio === '16:9' && dayEvents.length > 1) || dayEvents.length > 2) ? 'grid-cols-2' : 'grid-cols-1')}`}>
                  {dayEvents.map(event => {
                   const isAllDay = !event.start?.dateTime && event.start?.date;
                   let timeDisplay = '';
                   if (!isAllDay && event.start?.dateTime) {
                     const d = new Date(event.start.dateTime);
                     const h = d.getHours();
                     const m = d.getMinutes();
                     const ampm = h >= 12 ? 'PM' : 'AM';
                     const hour12 = h % 12 || 12;
                     timeDisplay = m === 0 ? `${hour12}${ampm} ` : `${hour12}:${m.toString().padStart(2, '0')}${ampm} `;
                   }
                   let displaySummary = event.summary;
                   if (event.isHoliday && (/lunar new year|農曆年初|農曆新年/i.test(displaySummary))) {
                     if (lunarMonth === 1 && lunarDay <= 15) {
                       displaySummary = `農曆年${lunar.getDayInChinese()}`;
                     }
                   }
                   return (
                     <div 
                       key={event.id} 
                       className="relative z-20 group/event flex-shrink-0 h-max w-full"
                     >
                        <div 
                          className={`w-full border border-black rounded ${isExport ? (isExportBlank ? 'text-[24px] px-1.5 py-1 border-[3px]' : 'text-[18px] sm:text-[20px] px-1.5 py-1 border-[2px]') : 'text-[8.5px] sm:text-[10px] md:text-[11px] lg:text-[12px] xl:text-[14px] 2xl:text-[16px] px-[1.5px] md:px-[2px] lg:px-[4px] py-[2px] sm:px-1 sm:py-0.5 lg:py-[4px]'} leading-[1.1] sm:leading-[1.15] tracking-tight whitespace-pre-wrap flex flex-col text-black ${event.isHoliday ? 'bg-[#FF6B6B] font-normal cursor-default' : (day.getTime() >= new Date().setHours(0,0,0,0) ? 'bg-[#E3F2FD] font-normal cursor-pointer hover:brightness-95' : 'bg-[#FFF9C4] font-normal cursor-pointer hover:brightness-95')}`} 
                          title={`${timeDisplay}${displaySummary}${event.description ? '\n' + event.description : ''}`}
                          onClick={(e) => {
                            if (!event.isHoliday && onEventClick) {
                              e.stopPropagation();
                              onEventClick(event);
                            }
                          }}
                        >
                          <div className={`line-clamp-none break-all ${isExportBlank ? 'leading-[1.15]' : 'leading-tight'}`}>
                            {timeDisplay && <div className="opacity-90 font-sans whitespace-nowrap pb-0.5">{timeDisplay}</div>}
                            <div>{displaySummary}</div>
                          </div>
                          {event.description && (
                            <div className={`font-normal opacity-90 block mt-0.5 ${isExport ? 'text-[18px] sm:text-[20px] mt-1' : 'text-[8px] sm:text-[9.5px] md:text-[10px] lg:text-[11px] xl:text-[12px] 2xl:text-[14px]'} line-clamp-none leading-tight whitespace-pre-wrap ${isExportBlank ? 'hidden' : ''}`}>{event.description}</div>
                          )}
                        </div>
                       {!event.isHoliday && !isExport && (
                         <button
                           onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(event); }}
                           className={`absolute -top-[5px] -right-[5px] sm:-top-[5px] sm:-right-[5px] ${isClicked ? 'opacity-100 flex' : 'opacity-0 hidden sm:flex'} group-hover/event:opacity-100 bg-[#FF6B6B] text-white border-[1.5px] border-black rounded-full p-[3px] sm:p-[2px] z-30 items-center justify-center cursor-pointer`}
                           title="刪除"
                           style={{ touchAction: 'manipulation' }}
                           data-export-ignore="true"
                         >
                           <Trash2 className="w-[14px] h-[14px] sm:w-[12px] sm:h-[12px]" />
                         </button>
                       )}
                     </div>
                   );
                })}
                </div>
                {(toggleShift || shifts?.[dateStr]) && (
                  <div 
                    onClick={(e) => toggleShift?.(dateStr, e)}
                    className={`absolute z-30 flex items-center justify-center transition-all select-none
                      ${isExportBlank && shifts?.[dateStr]
                        ? (shrinkExportShift 
                           ? 'bottom-2 right-2 w-[72px] h-[72px] text-[48px] rounded-[10px] font-black border-[3px] shadow-[4px_4px_0_#000]' 
                           : 'bottom-2 right-2 sm:bottom-4 sm:right-4 w-[33%] h-[33%] text-[32px] sm:text-[42px] rounded-[10px] font-black border-[3px] shadow-[4px_4px_0_#000]')
                        : (isExport && shifts?.[dateStr] 
                            ? 'bottom-1 right-1 w-[32px] h-[32px] text-[20px] rounded-lg font-black border-[2px] shadow-[2px_2px_0_#000]'
                            : 'bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 w-5 h-5 sm:w-6 sm:h-6 text-[10px] sm:text-xs rounded-sm font-bold sm:font-black border shadow-[1px_1px_0_#000]')
                      }
                      ${toggleShift ? 'cursor-pointer' : ''} 
                      ${shifts?.[dateStr] 
                        ? (shifts[dateStr] === 'D' 
                            ? 'opacity-100 text-black bg-[#FFD700] border-black' 
                            : 'opacity-100 text-[#FFD700] bg-black border-black') 
                        : 'opacity-10 sm:opacity-0 group-hover:opacity-10 group-focus-within:opacity-10 hover:!opacity-40 bg-gray-200 border-transparent shadow-none'}`}
                    data-export-ignore={!shifts?.[dateStr] ? "true" : undefined}
                    title="更表標記 (空/D/N)"
                  >
                    {shifts?.[dateStr] || '・'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DiaryForm({ 
  mode, 
  events, 
  onEventAdded, 
  clickedDate,
  editingEvent,
  onEventUpdated,
  onCancelEdit
}: { 
  mode: 'past' | 'future' | 'edit', 
  events: CalendarEvent[], 
  onEventAdded: (ev: CalendarEvent) => void, 
  clickedDate?: Date | null,
  editingEvent?: CalendarEvent | null,
  onEventUpdated?: (ev: CalendarEvent) => void,
  onCancelEdit?: () => void
}) {
  const [selectedActivity, setSelectedActivity] = useState(PREDEFINED_ACTIVITIES[0]);
  const [customActivity, setCustomActivity] = useState("");
  const [note, setNote] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    if (mode === 'future') d.setDate(d.getDate() + 1);
    return format(d, "yyyy-MM-dd");
  });

  const [startHour, setStartHour] = useState(() => new Date().getHours());
  const [endHour, setEndHour] = useState(() => (new Date().getHours() + 1) % 24);

  useEffect(() => {
    if (editingEvent) {
      const summary = editingEvent.summary || "";
      if (PREDEFINED_ACTIVITIES.includes(summary)) {
        setSelectedActivity(summary);
        setCustomActivity("");
      } else {
        setSelectedActivity('自訂');
        setCustomActivity(summary);
      }
      setNote(editingEvent.description || "");
      
      const startDate = editingEvent.start?.dateTime ? new Date(editingEvent.start.dateTime) : (editingEvent.start?.date ? new Date(editingEvent.start.date) : new Date());
      setSelectedDate(format(startDate, "yyyy-MM-dd"));
      if (editingEvent.start?.dateTime) {
        setStartHour(new Date(editingEvent.start.dateTime).getHours());
      }
      if (editingEvent.end?.dateTime) {
        setEndHour(new Date(editingEvent.end.dateTime).getHours());
      }
    } else if (clickedDate) {
      const today = new Date(new Date().setHours(0, 0, 0, 0));
      const clicked = new Date(clickedDate);
      clicked.setHours(0, 0, 0, 0);
      const isFutureClick = clicked > today;
      if ((mode === 'future' && isFutureClick) || (mode === 'past' && !isFutureClick)) {
        setSelectedDate(format(clickedDate, "yyyy-MM-dd"));
      }
    }
  }, [clickedDate, mode, editingEvent]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState("");

  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(""), 3000);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const finalActivity = customActivity.trim() !== "" ? customActivity.trim() : selectedActivity;
    
    if (!finalActivity) {
      showError("請選擇或輸入活動！");
      return;
    }

    const start = new Date(`${selectedDate}T${startHour.toString().padStart(2, '0')}:00:00`);
    if (isNaN(start.getTime())) {
      showError("請選擇有效的時間！");
      return;
    }
    
    let end = new Date(`${selectedDate}T${endHour.toString().padStart(2, '0')}:00:00`);
    if (end <= start) {
      end = addHours(end, 24); // next day
    }

    setIsSubmitting(true);
    try {
      const eventData = {
        summary: finalActivity,
        description: note,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
            { method: "popup", minutes: 0 },
          ],
        },
      };

      const url = editingEvent ? `/api/calendar/events/${editingEvent.id}` : '/api/calendar/events';
      const method = editingEvent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });

      if (res.ok) {
        const returnedEvent = await res.json();
        if (editingEvent && onEventUpdated) {
          onEventUpdated(returnedEvent);
          showError("✅ 修改成功！");
        } else {
          onEventAdded(returnedEvent);
          setCustomActivity("");
          setNote("");
          showError("✅ 新增成功！");
        }
      } else {
        const errData = await res.json().catch(() => null);
        if (res.status === 401 || res.status === 403) {
          showError(errData?.error || "授權已過期，請重新登入");
          setTimeout(() => window.location.reload(), 1500);
          return;
        }
        throw new Error(errData?.error || "API Error");
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "未知錯誤";
      showError(`❌ 新增失敗: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFuture = mode === 'future';

  return (
    <div className={`cartoon-border p-3 sm:p-4 ${isFuture ? 'bg-blue-50' : 'bg-cartoon-card'}`}>
      <AnimatePresence>
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 cartoon-border bg-cartoon-ink text-white px-6 py-3 font-bold"
          >
            {errorToast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center mb-3">
        <h1 className="text-2xl font-black flex items-center gap-2">
          {isFuture ? <span>🚀 加未來行程</span> : <span>✏️ 寫日記</span>}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-1.5">
        <div>
          <label className="block font-bold mb-0.5 text-sm text-gray-700">
            {isFuture ? "打算做咩呀？" : "你做過咩呀？"}
          </label>
          <select 
            value={selectedActivity}
            onChange={e => {
              setSelectedActivity(e.target.value);
              setCustomActivity("");
            }}
            className="cartoon-input bg-white text-sm w-full"
          >
            {PREDEFINED_ACTIVITIES.map(act => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
          
          <input
            type="text"
            placeholder="自訂活動 ✨"
            value={customActivity}
            onChange={e => setCustomActivity(e.target.value)}
            className="cartoon-input mt-2 text-sm bg-white w-full"
          />
        </div>

        <div>
          <label className="block font-bold mb-0.5 text-sm text-gray-700">幾時？</label>
          <div className="flex gap-2 mb-1.5">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="cartoon-input bg-white text-sm w-full"
            />
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <select
              value={startHour}
              onChange={e => setStartHour(Number(e.target.value))}
              className="cartoon-input bg-white text-center text-sm w-full"
              style={{ textAlignLast: 'center' }}
            >
              {Array.from({ length: 24 }).map((_, i) => {
                const formatHour = (h: number) => {
                  if (h === 0) return '12AM';
                  if (h === 12) return '12PM';
                  return h > 12 ? `${h - 12}PM` : `${h}AM`;
                };
                return (
                  <option key={i} value={i}>
                    {formatHour(i)}
                  </option>
                );
              })}
            </select>
            <span className="font-bold text-gray-500 text-sm">至</span>
            <select
              value={endHour}
              onChange={e => setEndHour(Number(e.target.value))}
              className="cartoon-input bg-white text-center text-sm w-full"
              style={{ textAlignLast: 'center' }}
            >
              {Array.from({ length: 24 }).map((_, i) => {
                const formatHour = (h: number) => {
                  if (h === 0) return '12AM';
                  if (h === 12) return '12PM';
                  return h > 12 ? `${h - 12}PM` : `${h}AM`;
                };
                return (
                  <option key={i} value={i}>
                    {formatHour(i)}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div>
          <label className="block font-bold mb-0.5 text-sm text-gray-700">備註 (選填)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="寫低啲感受啦..."
            className="w-full cartoon-input bg-white min-h-[60px] text-sm resize-none"
          />
        </div>

        {onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="cartoon-border w-full text-black bg-white hover:bg-gray-100 font-black text-base py-2 mb-2"
          >
            取消修改
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`cartoon-border w-full text-white font-black text-base py-2 flex items-center justify-center gap-1.5 disabled:opacity-70 ${isFuture || editingEvent ? 'bg-cartoon-secondary hover:bg-blue-500' : 'bg-cartoon-primary hover:bg-[#F4511E]'}`}
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingEvent ? <Save className="w-5 h-5" /> : (isFuture ? <Plus className="w-5 h-5" /> : <Save className="w-5 h-5" />))}
          {isSubmitting ? "儲存緊..." : (editingEvent ? "確認修改" : "記低佢！")}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorToast, setErrorToast] = useState("");
  const [viewMode, setViewMode] = useState<'home' | 'history'>('home');
  const [historyFilter, setHistoryFilter] = useState<'2weeks' | '1month' | 'all'>('2weeks');
  const [pendingDelete, setPendingDelete] = useState<{ event: CalendarEvent, timeoutId: NodeJS.Timeout } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [clickedDate, setClickedDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [mobileForm, setMobileForm] = useState<'none' | 'past' | 'future' | 'edit'>('none');

  const [hideStemBranch, setHideStemBranch] = useState(() => {
    return localStorage.getItem('diary_hide_stem_branch') === 'true';
  });

  const [hideExportEvents, setHideExportEvents] = useState(() => {
    return localStorage.getItem('diary_hide_export_events') === 'true';
  });

  const [enlargeExportStemBranch, setEnlargeExportStemBranch] = useState(() => {
    return localStorage.getItem('diary_enlarge_export_stem_branch') === 'true';
  });

  const [shrinkExportShift, setShrinkExportShift] = useState(() => {
    return localStorage.getItem('diary_shrink_export_shift') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('diary_hide_stem_branch', String(hideStemBranch));
  }, [hideStemBranch]);

  useEffect(() => {
    localStorage.setItem('diary_hide_export_events', String(hideExportEvents));
  }, [hideExportEvents]);

  useEffect(() => {
    localStorage.setItem('diary_enlarge_export_stem_branch', String(enlargeExportStemBranch));
  }, [enlargeExportStemBranch]);

  useEffect(() => {
    localStorage.setItem('diary_shrink_export_shift', String(shrinkExportShift));
  }, [shrinkExportShift]);

  const [shifts, setShifts] = useState<Record<string, 'D' | 'N'>>(() => {
    try {
      const saved = localStorage.getItem('diary_shifts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  const [shiftEvents, setShiftEvents] = useState<Record<string, any>>({});

  useEffect(() => {
    localStorage.setItem('diary_shifts', JSON.stringify(shifts));
  }, [shifts]);

  const toggleShift = async (dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const current = shifts[dateStr];
    let next: 'D' | 'N' | undefined;
    if (!current) next = 'D';
    else if (current === 'D') next = 'N';
    else next = undefined;
    
    // Optimistic UI update
    setShifts(prev => {
      const copy = { ...prev };
      if (!next) delete copy[dateStr];
      else copy[dateStr] = next;
      return copy;
    });

    const existingEv = shiftEvents[dateStr];
    
    // Delete old if exists
    if (existingEv) {
      setShiftEvents(prev => {
        const copy = { ...prev };
        delete copy[dateStr];
        return copy;
      });
      fetch(`/api/calendar/events/${existingEv.id}`, { method: 'DELETE' }).catch(console.error);
    }
    
    // Create new if next is present
    if (next) {
      const dt = new Date(dateStr);
      const endDt = new Date(dt);
      endDt.setDate(endDt.getDate() + 1);
      
      const payload = {
        summary: `[Shift]-${next}`,
        start: { date: dateStr },
        end: { date: endDt.toISOString().split('T')[0] }
      };
      
      fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(r => r.json())
      .then(newEv => {
        if (!newEv.error) {
           setShiftEvents(prev => ({ ...prev, [dateStr]: newEv }));
        }
      })
      .catch(console.error);
    }
  };

  const [isExportBlank, setIsExportBlank] = useState(false);
  const [exportRatio, setExportRatio] = useState<'16:9' | '4:3' | '1:1'>('4:3');
  const [exportPending, setExportPending] = useState<'full' | 'blank' | null>(null);

  const handleExportImage = async (blank: boolean = false, ratio: '16:9' | '4:3' | '1:1' = '4:3') => {
    setExportRatio(ratio);
    setIsExporting(true);
    setIsExportBlank(blank);

    // Give react and the browser layout engine time to render the new state, especially for large grids
    await new Promise(r => setTimeout(r, 600));

    const node = document.getElementById('hidden-export-container');
    if (!node) {
      showError("❌ 沒有內容可以匯出");
      setIsExportBlank(false);
      setIsExporting(false);
      return;
    }
    try {
      const exportWidth = ratio === '16:9' ? 2400 : 1800;
      const exportHeight = ratio === '1:1' ? 1800 : 1350;
      
      const blob = await toBlob(node, { 
        backgroundColor: '#fdf2f8',
        pixelRatio: 1,
        width: exportWidth, // This relies on the hidden grid actually being scaled correctly natively
        height: exportHeight,
        style: {
          transform: 'none',
        },
        filter: (n) => {
          // ignore elements with data-export-ignore
          if (n instanceof HTMLElement && n.dataset.exportIgnore) return false;
          return true;
        }
      });
      
      if (!blob) throw new Error("Could not generate image blob");
      const dataUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `my-diary-${format(new Date(), 'yyyyMMdd-HHmmss')}.png`;
      link.href = dataUrl;
      link.click();
      
      // Cleanup to prevent memory leaks
      setTimeout(() => URL.revokeObjectURL(dataUrl), 10000);
      showError("✅ 成功匯出圖片", 3000);
    } catch (err) {
      console.error(err);
      showError("❌ 圖片匯出失敗");
    } finally {
      setIsExportBlank(false);
      setIsExporting(false);
    }
  };

  const showError = (msg: string, duration = 3000) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(""), duration);
  };

  const handleUndo = () => {
    if (pendingDelete) {
      clearTimeout(pendingDelete.timeoutId);
      setEvents(prev => [...prev, pendingDelete.event]);
      setPendingDelete(null);
      showError("✅ 已取消刪除");
    }
  };

  const checkAuth = async () => {
    try {
      const res = await fetch(`/api/auth/status?t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      setIsAuthenticated(data.isAuthenticated);
      if (data.isAuthenticated) {
        fetchEvents();
      } else {
        setIsLoading(false);
      }
    } catch (e) {
      console.error(e);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        checkAuth();
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/calendar/events');
      if (res.ok) {
        const data = await res.json();
        
        const normalEvents: typeof data = [];
        const sfEvents: Record<string, any> = {};
        const newShifts: Record<string, 'D' | 'N'> = {};
        const duplicateEvents: any[] = [];
        
        data.forEach((ev: any) => {
          if (ev.summary === '[Shift]-D' || ev.summary === '[Shift]-N') {
            const dateStr = ev.start?.date || ev.start?.dateTime?.split('T')[0];
            if (dateStr) {
               if (sfEvents[dateStr]) {
                 // Found a duplicate on the same date, mark it for deletion
                 duplicateEvents.push(ev);
               } else {
                 sfEvents[dateStr] = ev;
                 newShifts[dateStr] = ev.summary === '[Shift]-D' ? 'D' : 'N';
               }
            }
          } else {
            normalEvents.push(ev);
          }
        });
        
        setShiftEvents(sfEvents);
        
        // Google Calendar is the source of truth, completely replace local shifts
        setShifts(newShifts);
        setEvents(normalEvents);
        
        if (duplicateEvents.length > 0) {
           const cleanDuplicates = async () => {
             for (const dup of duplicateEvents) {
               try {
                 await fetch(`/api/calendar/events/${dup.id}`, { method: 'DELETE' });
                 await new Promise(r => setTimeout(r, 500));
               } catch (e) {
                 console.error(e);
               }
             }
           };
           cleanDuplicates();
        }
      } else if (res.status === 401 || res.status === 403) {
        setIsAuthenticated(false);
        const err = await res.json().catch(() => null);
        if (err?.error) showError(err.error);
      }
    } catch (e) {
      console.error("Failed to fetch events", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/auth/url');
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();
      
      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        alert('Please allow popups for this site to connect your account.');
      }
    } catch (error) {
      console.error('OAuth error:', error);
      showError("無法開啟登入視窗");
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
    setEvents([]);
    setShifts({});
    setShiftEvents({});
  };

  const handleDelete = (event: CalendarEvent) => {
    // 隱藏該活動
    setEvents(prev => prev.filter(ev => ev.id !== event.id));
    
    // 如果已有其他等待刪除的，先執行刪除
    if (pendingDelete) {
        clearTimeout(pendingDelete.timeoutId);
        fetch(`/api/calendar/events/${pendingDelete.event.id}`, { method: 'DELETE' }).catch(console.error);
    }
    
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/calendar/events/${event.id}`, { method: 'DELETE' });
        if (!res.ok) {
           if (res.status === 401 || res.status === 403) {
             const err = await res.json().catch(() => null);
             showError(err?.error || "授權已過期，請重新登入");
             setTimeout(() => window.location.reload(), 1500);
           } else {
             showError("❌ 刪除失敗");
           }
        }
      } catch (e) {
        console.error(e);
      }
      setPendingDelete(prev => (prev?.event.id === event.id ? null : prev));
    }, 5000);

    setPendingDelete({ event, timeoutId });
    showError("✅ 活動已移除", 5000);
  };

  if (isAuthenticated === null || (isLoading && events.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cartoon-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Floating background shapes */}
        <div className="absolute top-10 left-10 w-24 h-24 bg-cartoon-primary rounded-full opacity-20 blur-xl"></div>
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-cartoon-secondary rounded-full opacity-20 blur-xl"></div>
        
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="cartoon-border bg-cartoon-card p-10 max-w-md w-full text-center relative z-10"
        >
          <div className="mb-6 flex justify-center">
            <span className="text-6xl">📖</span>
          </div>
          <h1 className="text-4xl font-black mb-4 text-cartoon-ink tracking-tight">
            超簡單日記
          </h1>
          <p className="text-lg mb-8 font-bold opacity-80">
            用 Google Calendar 記錄你的精彩生活！不佔手機容量，隨時回味！✨
          </p>
          <button
            onClick={handleLogin}
            className="cartoon-border bg-cartoon-accent text-cartoon-ink font-black text-xl py-4 px-8 w-full flex items-center justify-center gap-3 hover:bg-yellow-400"
          >
            <Calendar className="w-6 h-6" />
            連結 Google 日曆
          </button>
          <p className="mt-4 text-sm font-bold opacity-60">支援提醒功能 ⏰ 活動不漏接</p>
        </motion.div>
      </div>
    );
  }

  const todayAtMidnight = new Date();
  todayAtMidnight.setHours(0, 0, 0, 0);

  // Group events by date for the calendar
  const groupedEvents: Record<string, CalendarEvent[]> = {};
  events.forEach(ev => {
    const timeStr = ev.start?.dateTime || ev.start?.date;
    if (!timeStr) return;
    
    const evDate = new Date(timeStr);
    const dateKey = format(evDate, "yyyy-MM-dd");
    if (!groupedEvents[dateKey]) groupedEvents[dateKey] = [];
    groupedEvents[dateKey].push(ev);
  });

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 })
  });

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    if (window.innerWidth < 1024) {
      setMobileForm('edit');
    }
  };

  const handleUpdateEvent = (updatedEv: CalendarEvent) => {
    setEvents(prev => prev.map(e => e.id === updatedEv.id ? updatedEv : e));
    setEditingEvent(null);
    setMobileForm('none');
  };

  const isEditingEventFuture = editingEvent ? new Date(editingEvent.start?.dateTime || editingEvent.start?.date || new Date().toISOString()) >= new Date(new Date().setHours(0,0,0,0)) : false;

  return (
    <>
    <div className="min-h-screen pb-48 lg:pb-8 p-1 sm:py-2 sm:px-4 max-w-[1800px] mx-auto flex flex-col lg:flex-row gap-4 lg:gap-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 cartoon-border bg-cartoon-ink text-white px-6 py-3 font-bold flex flex-wrap items-center gap-4 min-w-fit whitespace-nowrap"
          >
            <span>{errorToast}</span>
            {pendingDelete && errorToast === "✅ 活動已移除" && (
              <button 
                onClick={handleUndo} 
                className="underline text-blue-300 hover:text-white"
              >
                復原 (Undo)
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Column: Form */}
      {viewMode === 'home' && (
        <div className="hidden lg:flex flex-col w-full lg:w-[200px] xl:w-[240px] flex-shrink-0 gap-3 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto no-scrollbar p-1 pb-4">
          <DiaryForm 
            mode={editingEvent && !isEditingEventFuture ? 'edit' : 'past'} 
            events={events} 
            onEventAdded={(ev) => setEvents(prev => [...prev, ev])} 
            clickedDate={clickedDate} 
            editingEvent={!isEditingEventFuture ? editingEvent : undefined}
            onEventUpdated={handleUpdateEvent}
            onCancelEdit={editingEvent && !isEditingEventFuture ? () => setEditingEvent(null) : undefined}
          />
        </div>
      )}

      {/* Middle Column: Timeline */}
      <div className={`w-full ${viewMode === 'home' ? 'lg:flex-1' : 'w-full xl:w-11/12 mx-auto'}`}>
        <div className={`${viewMode === 'home' ? 'hidden' : ''} flex flex-row flex-wrap items-center justify-center md:justify-between mb-2 sm:mb-4 gap-x-2 sm:gap-x-4 gap-y-3 overflow-visible`}>
          <div className="flex flex-row flex-wrap justify-center items-center gap-2 sm:gap-4 shrink-0">
            <h2 className="text-2xl sm:text-4xl font-black shrink-0">{viewMode === 'home' ? '我的行程 📅' : '我的日記 📖'}</h2>
            {viewMode === 'home' ? (
              <button 
                onClick={() => setViewMode('history')}
                className="cartoon-border font-bold px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center shrink-0"
              >
                查看日記 <span className="ml-1 text-base leading-none">👀</span>
              </button>
            ) : (
              <button 
                onClick={() => setViewMode('home')}
                className="cartoon-border font-bold px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-cartoon-secondary text-white hover:opacity-90 flex items-center justify-center shrink-0"
              >
                回到首頁 <span className="ml-1 text-base leading-none">🏠</span>
              </button>
            )}
          </div>
          <div className="hidden lg:flex flex-row justify-center items-center gap-2 shrink-0" data-export-ignore="true">
            <label className="flex items-center gap-1.5 cartoon-border bg-white text-sm font-bold px-2 py-1.5 sm:px-3 sm:py-2 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
              <input 
                type="checkbox" 
                checked={hideStemBranch} 
                onChange={e => setHideStemBranch(e.target.checked)} 
                className="w-4 h-4 cursor-pointer"
              />
              隱藏天干地支
            </label>
            <div className="h-6 w-px bg-gray-300 mx-1"></div>
            <label className="flex items-center gap-1.5 cartoon-border bg-white text-sm font-bold px-2 py-1.5 sm:px-3 sm:py-2 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
              <input 
                type="checkbox" 
                checked={hideExportEvents} 
                onChange={e => setHideExportEvents(e.target.checked)} 
                className="w-4 h-4 cursor-pointer"
              />
              匯出隱藏行程
            </label>
            <button 
              onClick={() => setExportPending('full')} 
              disabled={isExporting}
              className="cartoon-border bg-white text-sm font-bold px-2 py-1.5 sm:px-3 sm:py-2 hover:bg-blue-50 text-cartoon-primary disabled:opacity-50 flex items-center justify-center whitespace-nowrap" 
              title="匯出完整圖片"
            >
              {isExporting && !isExportBlank ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1 animate-spin" /> : <Camera className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />}
              匯出完整
            </button>
            <button 
              onClick={() => setExportPending('blank')} 
              disabled={isExporting}
              className="cartoon-border bg-white text-sm font-bold px-2 py-1.5 sm:px-3 sm:py-2 hover:bg-blue-50 text-cartoon-primary disabled:opacity-50 flex items-center justify-center whitespace-nowrap" 
              title="匯出更表"
            >
              {isExporting && isExportBlank ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1 animate-spin" /> : <Camera className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />}
              匯出更表
            </button>
            <button onClick={fetchEvents} className="cartoon-border bg-white p-1.5 sm:p-2 flex items-center justify-center hover:bg-blue-50" title="重新整理">
              <Loader2 className={isLoading ? "w-5 h-5 sm:w-6 sm:h-6 animate-spin" : "w-5 h-5 sm:w-6 sm:h-6"} />
            </button>
            <button 
              onClick={() => {
                fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location.reload());
              }} 
              className="cartoon-border bg-white px-3 sm:px-4 py-1.5 sm:py-2 hover:bg-red-50 text-cartoon-danger font-bold flex items-center justify-center gap-1 sm:gap-2" 
              title="登出"
            >
              <LogOut className="w-5 h-5 sm:w-5 sm:h-5 shrink-0" />
            </button>
          </div>
        </div>

        <TimelineGrid
          containerId="timeline-container"
          currentMonth={currentMonth}
          daysInMonth={daysInMonth}
          groupedEvents={groupedEvents}
          handleDelete={handleDelete}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
          todayAtMidnight={todayAtMidnight}
          shifts={shifts}
          toggleShift={toggleShift}
          clickedDate={clickedDate}
          hideStemBranch={hideStemBranch}
          enlargeExportStemBranch={enlargeExportStemBranch}
          shrinkExportShift={shrinkExportShift}
          onDateClick={(date) => {
             if (clickedDate && isSameDay(date, clickedDate)) {
               setClickedDate(null);
             } else {
               setClickedDate(date);
             }
          }}
          onDateDoubleClick={(date) => {
             setClickedDate(date);
             const todayOrFuture = date.getTime() >= new Date().setHours(0,0,0,0);
             setMobileForm(todayOrFuture ? 'future' : 'past');
          }}
          onEventClick={handleEventClick}
        />
      </div>

      {/* Right Column: Future Form */}
      {viewMode === 'home' && (
        <div className="hidden lg:flex flex-col gap-3 w-full lg:w-[200px] xl:w-[240px] flex-shrink-0 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto no-scrollbar p-1 pb-4">
          <DiaryForm 
            mode={editingEvent && isEditingEventFuture ? 'edit' : 'future'} 
            events={events} 
            onEventAdded={(ev) => setEvents(prev => [...prev, ev])} 
            clickedDate={clickedDate} 
            editingEvent={isEditingEventFuture ? editingEvent : undefined}
            onEventUpdated={handleUpdateEvent}
            onCancelEdit={editingEvent && isEditingEventFuture ? () => setEditingEvent(null) : undefined}
          />
          
          <div className="flex flex-col gap-2 p-2 bg-white/50 rounded-xl border-2 border-cartoon-primary cartoon-border" data-export-ignore="true">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer hover:bg-white/80 p-1 rounded -mx-1">
              <input type="checkbox" checked={hideStemBranch} onChange={e => setHideStemBranch(e.target.checked)} className="w-3.5 h-3.5 cursor-pointer" />
              隱藏天干地支
            </label>
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer hover:bg-white/80 p-1 rounded -mx-1">
              <input type="checkbox" checked={hideExportEvents} onChange={e => setHideExportEvents(e.target.checked)} className="w-3.5 h-3.5 cursor-pointer" />
              匯出隱藏行程
            </label>
            
            <div className="flex flex-col gap-1 mt-0.5">
              <button onClick={() => setExportPending('full')} disabled={isExporting} className="cartoon-border w-full bg-white text-xs font-bold p-1.5 hover:bg-blue-50 text-cartoon-primary flex items-center justify-center disabled:opacity-50">
                {isExporting && !isExportBlank ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Camera className="w-3.5 h-3.5 mr-1" />}
                匯出完整
              </button>
              <button onClick={() => setExportPending('blank')} disabled={isExporting} className="cartoon-border w-full bg-white text-xs font-bold p-1.5 hover:bg-blue-50 text-cartoon-primary flex items-center justify-center disabled:opacity-50">
                {isExporting && isExportBlank ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Camera className="w-3.5 h-3.5 mr-1" />}
                匯出更表
              </button>
            </div>

            <div className="flex flex-row gap-1 mt-0.5">
              <button onClick={fetchEvents} className="cartoon-border flex-1 bg-white p-1.5 hover:bg-blue-50 flex items-center justify-center" title="重新整理">
                <Loader2 className={isLoading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
              </button>
              <button onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location.reload())} className="cartoon-border flex-1 bg-white p-1.5 hover:bg-red-50 text-cartoon-danger flex items-center justify-center" title="登出">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Action Bar */}
      {viewMode === 'home' && (
        <div className="lg:hidden mt-6 mb-8 px-2 flex flex-col justify-center items-center gap-4 w-full" data-export-ignore="true">
          <div className="w-full max-w-sm flex flex-col gap-3 bg-white p-4 rounded-3xl cartoon-border shadow-sm">
            {/* Header Row */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h2 className="text-xl font-black tracking-tight ml-1">我的行程 📅</h2>
              <button 
                onClick={() => setViewMode('history')}
                className="cartoon-border font-bold px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 flex items-center justify-center transform transition-transform active:scale-95"
              >
                查看日記 <span className="ml-1 text-sm leading-none">👀</span>
              </button>
            </div>
          
          {/* Add Actions Row */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setMobileForm('past')}
              className="flex-1 cartoon-border bg-cartoon-primary text-white py-2 font-black text-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" /> 補寫日記
            </button>
            <button 
              onClick={() => setMobileForm('future')}
              className="flex-1 cartoon-border bg-cartoon-secondary text-white py-2 font-black text-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" /> 未來日程
            </button>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-2">
              <button onClick={() => setExportPending('full')} disabled={isExporting} className="cartoon-border w-full bg-[#FFF9C4] text-xs font-bold p-2 text-cartoon-primary flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform">
                {isExporting && !isExportBlank ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Camera className="w-3.5 h-3.5 mr-1" />}
                匯出完整
              </button>
              <button onClick={() => setExportPending('blank')} disabled={isExporting} className="cartoon-border w-full bg-[#FFF9C4] text-xs font-bold p-2 text-cartoon-primary flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform">
                {isExporting && isExportBlank ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Camera className="w-3.5 h-3.5 mr-1" />}
                匯出更表
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="flex items-center justify-center gap-1.5 cartoon-border bg-gray-50 text-xs font-bold p-2 h-full cursor-pointer">
                <input type="checkbox" checked={hideStemBranch} onChange={e => setHideStemBranch(e.target.checked)} className="w-3.5 h-3.5" />
                隱藏天干地支
              </label>
              <div className="flex gap-2">
                <button onClick={fetchEvents} className="cartoon-border flex-1 bg-gray-50 p-2 flex items-center justify-center active:scale-95 transition-transform">
                  <Loader2 className={isLoading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
                </button>
                <button onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location.reload())} className="cartoon-border flex-1 bg-white p-2 hover:bg-red-50 text-cartoon-danger flex items-center justify-center active:scale-95 transition-transform">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Mobile Form Modal */}
      <AnimatePresence>
        {mobileForm !== 'none' && (
          <motion.div 
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm p-4 pb-24 sm:pb-8"
          >
            <div className="cartoon-border bg-white rounded-3xl w-full max-w-sm mx-auto relative overflow-hidden flex flex-col max-h-full">
              <div className="bg-[#f0f0f0] p-3 flex justify-between items-center border-b border-black shrink-0">
                <span className="font-black px-2">{mobileForm === 'edit' ? '📝 修改項目' : (mobileForm === 'future' ? '🚀 新增未來行程' : '✏️ 補寫日記')}</span>
                <button 
                  onClick={() => {
                    setMobileForm('none');
                    setEditingEvent(null);
                  }}
                  className="cartoon-border bg-white w-8 h-8 rounded-full flex items-center justify-center font-black active:scale-95"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 overflow-y-auto">
                <DiaryForm 
                  mode={mobileForm} 
                  events={events} 
                  onEventAdded={(ev) => {
                    setEvents(prev => [...prev, ev]);
                    setMobileForm('none');
                  }} 
                  clickedDate={clickedDate} 
                  editingEvent={editingEvent}
                  onEventUpdated={handleUpdateEvent}
                  onCancelEdit={editingEvent ? () => { setEditingEvent(null); setMobileForm('none'); } : undefined}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    <AnimatePresence>
      {exportPending && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="cartoon-border bg-white rounded-3xl w-full max-w-sm overflow-hidden flex flex-col"
          >
            <div className="bg-[#f0f0f0] p-4 border-b border-black text-center font-black text-lg">
              {exportPending === 'blank' ? '匯出更表' : '匯出完整'}
            </div>
            <div className="p-6 flex flex-col gap-4">
              <label className="font-bold flex items-center gap-2">選擇圖片比例：</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: '4:3', label: '4:3' },
                  { value: '16:9', label: '16:9' },
                  { value: '1:1', label: '1:1' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    disabled={isExporting}
                    onClick={() => handleExportImage(exportPending === 'blank', opt.value as any).then(() => setExportPending(null))}
                    className="cartoon-border bg-white py-3 font-black text-sm hover:bg-gray-50 active:translate-y-1 transition-all flex justify-center items-center disabled:opacity-50"
                  >
                    {exportRatio === opt.value && isExporting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    {opt.label}
                  </button>
                ))}
              </div>
              {exportPending === 'blank' && (
                <div className="flex flex-col gap-2">
                  <label className={`flex items-center gap-1.5 cartoon-border bg-white text-sm font-bold px-3 py-2 hover:bg-gray-50 cursor-pointer justify-center mt-2 ${isExporting ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input 
                      type="checkbox" 
                      disabled={isExporting}
                      checked={enlargeExportStemBranch} 
                      onChange={e => setEnlargeExportStemBranch(e.target.checked)} 
                      className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                    />
                    放大天干地支文字
                  </label>
                  <label className={`flex items-center gap-1.5 cartoon-border bg-white text-sm font-bold px-3 py-2 hover:bg-gray-50 cursor-pointer justify-center ${isExporting ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input 
                      type="checkbox" 
                      disabled={isExporting}
                      checked={shrinkExportShift} 
                      onChange={e => setShrinkExportShift(e.target.checked)} 
                      className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                    />
                    縮小更表標記至右下角
                  </label>
                </div>
              )}
              <button 
                disabled={isExporting}
                onClick={() => setExportPending(null)}
                className="cartoon-border mt-2 bg-gray-100 hover:bg-gray-200 py-2 font-bold transition-all disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Hidden export container rendered natively at 1800px width so html-to-image captures proper grid layout without jumping */}
    <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', pointerEvents: 'none' }}>
      <TimelineGrid
        containerId="hidden-export-container"
        currentMonth={currentMonth}
        daysInMonth={daysInMonth}
        groupedEvents={groupedEvents}
        handleDelete={handleDelete}
        prevMonth={prevMonth}
        nextMonth={nextMonth}
        todayAtMidnight={todayAtMidnight}
        isExport={true}
        isExportBlank={isExportBlank}
        exportRatio={exportRatio}
        shifts={shifts}
        clickedDate={clickedDate}
        hideStemBranch={hideStemBranch}
        hideEvents={hideExportEvents}
        enlargeExportStemBranch={enlargeExportStemBranch}
        shrinkExportShift={shrinkExportShift}
      />
    </div>

    </>
  );
}
