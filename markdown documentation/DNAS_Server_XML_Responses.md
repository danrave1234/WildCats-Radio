::: header
# Shoutcast DNAS Server XML Responses {#shoutcast-dnas-server-xml-responses align="center"}

(Last Updated 08 Sep 2018)
:::

+-----------------------------------------------------------------------+
| ::: {#toctitle}                                                       |
| **Contents** [\[[hide](javascript:toggleToc()){#togglelink            |
| .internal}\]]{.toctoggle}                                             |
| :::                                                                   |
|                                                                       |
| - [1 Introduction](#Introduction)                                     |
| - [2 How to Access the XML                                            |
|   Responses](#How_to_Access_the_XML_Responses)                        |
|   - [2.1 Full Server Summary](#Full_Server_Summary)                   |
|   - [2.2 General Server Summary](#General_Server_Summary)             |
|   - [2.3 Listener Statistics](#Listener_Statistics)                   |
|   - [2.4 Song History](#Song_History)                                 |
|   - [2.5 Stream Metadata](#Stream_Metadata)                           |
|   - [2.6 Stream Configurations](#Stream_Configurations)               |
|   - [2.7 Nextsongs](#Nextsongs)                                       |
|   - [2.8 Server Statistics](#Server_Statistics)                       |
|   - [2.9 Bandwidth Usage](#Bandwidth_Usage)                           |
|   - [2.10 Directory Status](#Directory_Status)                        |
|   - [2.11 7.html (Legacy)](#7.html)                                   |
+-----------------------------------------------------------------------+

[]{#Introduction}

## 1. Introduction

------------------------------------------------------------------------

The purpose of this document is to show you the information and format
of the different XML responses which the DNAS server (sc_serv) is able
to provide to allow access to the information about current connections
or available stream configurations for example.

\

[]{#How_to_Access_the_XML_Responses}

## 2. How to Access the XML Responses [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

With the 2.x DNAS server being able to support multiple streams compared
to the single stream which a 1.x DNAS server supports, to access
information for each stream requires you specify the stream identifier
of the stream that you require.

For example to access the General Server Summary ([see section
2.2](#General_Server_Summary)) for stream identifier **#1** then the
following would be used:

    http://<serverip>:<port>/admin.cgi?mode=viewxml&page=1&sid=1

\
or\

    http://<serverip>:<port>/stats?sid=1

To access the same information for stream identifier **#2** then replace
**1** with **2** and so on for any of the streams you want to obtain the
information from.\
\

    Throughout the rest of this document, it is assumed you know how to specify the
    stream identifier you require so only the base part of the url is shown i.e. /stats
    instead of /stats?sid=# where # is the stream identifier.

\

[]{#Full_Server_Summary}

## 2.1. Full Server Summary [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=viewxml** option, the XML
response consists of the general stream details which can be found over
the administration and public summary pages (if access to them is
enabled) in addition to details of the Listener Statistics ([see section
2.3](#Listener_Statistics)) and Song History ([see section
2.4](#Song_History)).

If you only require a specific set of information instead of everything
then you should use the **&page=X** parameter as the XML response from
this response is a combination of the following responses:

**General Server Summary** ([section 2.2](#General_Server_Summary))\
**Listener Statistics** ([section 2.3](#Listener_Statistics))\
**Song History** ([section 2.4](#Song_History))

\

[]{#General_Server_Summary}

## 2.2. General Server Summary [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=viewxml&page=1** or the
public **/stats** option, the XML response consists of the general
stream details which can be found over the administration and public
summary pages (if access to them is enabled). This is a compact version
of what is shown in the \'Full Server Summary\' ([see section
2.1](#Full_Server_Summary)) and acts as the equivalent of 7.html from
the 1.x DNAS server ([see section 3.0](#Equivalent_of_7.html)).

Example:

``` src
<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
  <SHOUTCASTSERVER>
    <CURRENTLISTENERS>0</CURRENTLISTENERS>
    <PEAKLISTENERS>0</PEAKLISTENERS>
    <!-- the maximum number of listener connections potentially allowed which depends -->
    <!-- on the maxuser and streammaxuser config options and other stream configs -->
    <MAXLISTENERS>32</MAXLISTENERS>
    <UNIQUELISTENERS>0</UNIQUELISTENERS>
    <!-- average time (seconds) of any active listener connections -->
    <AVERAGETIME>0</AVERAGETIME>

    <!-- these are some information about the stream as shown in listener clients, etc -->
    <SERVERGENRE>Misc</SERVERGENRE>
    <!-- there can also be: SERVERGENRE2, SERVERGENRE3, SERVERGENRE4 and -->
    <!-- SERVERGENRE5 elements depending on how the stream has been setup -->

    <SERVERURL>http://my_website.com</SERVERURL>
    <SERVERTITLE>Test Server</SERVERTITLE>

    <!-- if the Shoutcast source provides current and next song titles then -->
    <!-- they will be listed. if not known then these will be empty entries -->
    <SONGTITLE>The Current Song</SONGTITLE>
    <NEXTTITLE>The Next Song</NEXTTITLE>

    <!-- User ID of the source which typically comes from a Shoutcast 2.x source -->
    <!-- note: this can be present if a 1.x source is in use due to metadata updates -->
    <DJ>DJ Funky</DJ>

    <!-- if the Shoutcast source provides an associated song url e.g. via the updinfo -->
    <!-- method otherwise it is not included as not all sources usually provide this -->
    <SONGURL>http://my_website.com/about_the_song</SONGURL>

    <!-- cumulative total of any attempts to connect to the stream when it is active -->
    <STREAMHITS>0</STREAMHITS>

    <!-- shows 1 if a source is connected and 0 if there is no source -->
    <!-- note: if there is no source then no listener connections occur -->
    <!--       unless a valid backupfile has been configured to be used -->
    <STREAMSTATUS>1</STREAMSTATUS>

    <!-- shows 1 if a backup source is active instead of the main source -->
    <!-- due to connection issues and 0 if the backup source is not used -->
    <!-- note: if there is no source then no listener connections occur -->
    <!--       unless a valid backupfile has been configured to be used -->
    <BACKUPSTATUS>0</BACKUPSTATUS>

    <!-- shows 1 if successfully listed and 0 if not or is private -->
    <STREAMLISTED>1</STREAMLISTED>
    <!-- if there is an error being listed then the code is provided -->
    <!-- here and if there is no error then this is not provided -->
    <STREAMLISTEDERROR>480</STREAMLISTEDERROR>

    // these are only provided if a valid password is provided on the request
    // with information about the current source and backup (if set) provided
    <STREAMSOURCE>123.123.123.123</STREAMSOURCE>
    // this is not provided if there is no backup source specified
    <STREAMBACKUP>my_backup_url:port</STREAMBACKUP>

    <!-- time in seconds the stream has been running -->
    <!-- this is not provided if there is no stream -->
    <STREAMUPTIME>123</STREAMUPTIME>

    <!-- infomation about the format of the stream content and access path-->
    <STREAMPATH>/highdef</STREAMPATH>
    <BITRATE>320</BITRATE>
    <CONTENT>audio/aacp</CONTENT>

    <!-- version of the Shoutcast server being used -->
    <VERSION>2.2.0.107 (armv6(rpi))</VERSION>
  </SHOUTCASTSERVER>
```

\

[]{#Listener_Statistics}

## 2.3. Listener Statistics [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=viewxml&page=3** option,
the XML response has details about any currently connected listeners for
the specified stream. If there are no listeners connected then there
will be no \<LISTENER\> entries in the XML response generated.

Example:

``` src
<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
  <SHOUTCASTSERVER>
    <LISTENERS>
      <LISTENER>
        <HOSTNAME>127.0.0.1</HOSTNAME>
        <!-- this is set to **EMPTY** if no user agent was provided by the listener -->
        <USERAGENT>WinampMPEG/5.66</USERAGENT>
        <CONNECTTIME>1337</CONNECTTIME>
        <!-- a unique number for the listener connection used to determine duplicates -->
        <!-- this is unique whilst the listener is connected but can be re-used after -->
        <UID>01234567</UID>
        <!-- this represents the type of the listener client and anything else internally known -->
        <TYPE>1234567</TYPE>
        <!-- this is the referer header of the listener client connection (if provided) -->
        <REFERER>/admin.cgi</REFERER>
        <!-- this is the X-Forwarded-For header of the listener client connection (if provided) -->
        <XFF></XFF>
        <!-- this is the advert group id of the listener connection or zero if not gotten -->
        <GRID>0</GRID>
        <!-- this is the number of advert runs which have successfully succeed for the listener -->
        <TRIGGERS>123</TRIGGERS>
      </LISTENER>
    </LISTENERS>
  </SHOUTCASTSERVER>
```

\

[]{#Song_History}

## 2.4. Song History [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=viewxml&page=4** option,
the XML response is made from the currently stored played history (if
enabled) for the specified stream. If any song titles have been sent to
the server then they will displayed up to the number of songs played to
be stoeed (based on the \'songhistory\' and \'streamsonghistory\'
options ([see DNAS
server](http://wiki.shoutcast.com/wiki/SHOUTcast_DNAS_Server_2) -
[section
4.7](http://wiki.shoutcast.com/wiki/SHOUTcast_DNAS_Server_2#Miscellaneous)
and [section
4.12](http://wiki.shoutcast.com/wiki/SHOUTcast_DNAS_Server_2#Stream_Configuration)
respectively). If there are no song titles held or the DNAS server is
not configured to store them (see above) then there will be no \<SONG\>
entries in the XML response generated.

Example:

``` src
<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
  <SHOUTCASTSERVER>
    <SONGHISTORY>
      <SONG>
        <!-- PLAYEDAT is a raw time_t (UTC time) value of when the song was started -->
        <PLAYEDAT>1302180341</PLAYEDAT>
        <TITLE>The Previous Title</TITLE>
      </SONG>
      <SONG>
        <PLAYEDAT>1302175246</PLAYEDAT>
        <TITLE>The Current Song</TITLE>
      </SONG>
    </SONGHISTORY>
  </SHOUTCASTSERVER>
```

\

[]{#Stream_Metadata}

## 2.5. Stream Metadata [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=viewxml&page=5** option,
the XML response is the currently stored stream metadata as provided by
the connected stream source or from any manual title updates (e.g. when
using admin.cgi?sid=#&mode=updinfo&song=title) which may have been
received for the stream. This can contain just a title (typical with a
1.x stream source) or it can consist of complete range of metadata as
taken from the audio source when using a 2.x stream source e.g. an MP3
file with a complete ID3 tag.

Example:

``` src
<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
  <SHOUTCASTSERVER>
    <SONGMETADATA>
      <!-- this will be the only entry if a Shoutcast 1.x source is connected -->
      <TIT2>The Current Title</TIT2>
      <TALB>The Album Title</TALB>
      <TPE1>The Artist</TPE1>
      <TYER>2012</TYER>
      <TCON>Podcast</TCON>
      <TENC>Shoutcast Source DSP v2.3.3.201</TENC>
      <TRSN>My Shoutcast Server</TRSN>
      <WORS>http://www.shoutcast.com</WORS>
    </SONGMETADATA>
  </SHOUTCASTSERVER>
```

Detailed information on the supported fields as well as suggested fields
to provide from a 2.x stream source can be found in
[sc2_xml_metadata.txt](http://wiki.shoutcast.com/wiki/SHOUTcast_XML_Metadata_Specification).

\

[]{#Stream_Configurations}

## 2.6. Stream Configurations [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?sid=1&mode=viewxml&page=6**
option, the XML response is all currently known stream configuration
details (based on the configuration options set in the loaded
configuration file) as well as any global stream configuration options
which are applicable.

    This is a global action and the stream identifier is not be used but is required to
    allow the DNAS server to process the request correctly e.g. set sid=1 in all cases.

Example:

``` src
<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
  <SHOUTCASTSERVER>
    <STREAMCONFIGS>
      <!-- these are global settings / information about the stream configurations -->
      <!-- if REQUIRECONFIGS is 1 then only source connections matching are allowed -->
      <REQUIRECONFIGS>0</REQUIRECONFIGS>
      <SERVERMAXLISTENERS>32</SERVERMAXLISTENERS>
      <!-- if set as 0 then there is no limit on the stream(s) bitrate -->
      <SERVERMAXBITRATE>128</SERVERMAXBITRATE>
      <!-- this is the total number of stream configurations known and enabled -->
      <TOTALCONFIGS>1</TOTALCONFIGS>

      <!-- the value of 'id' relates to 'streamid' and is used to identify the group -->
      <STREAMCONFIG id="1">
        <STREAMAUTHHASH>my_aush_hash_if_entered</STREAMAUTHHASH>
        <STREAMPATH>/highdef</STREAMPATH>
        <STREAMRELAYURL></STREAMRELAYURL>
        <STREAMBACKUPURL></STREAMBACKUPURL>
        <!-- if set as SERVERMAXLISTENERS then the global SERVERMAXLISTENERS is in use -->
        <STREAMMAXLISTENERS>SERVERMAXLISTENERS</STREAMMAXLISTENERS>
        <!-- if set as SERVERMAXBITRATE then the global SERVERMAXBITRATE is in use -->
        <STREAMMAXBITRATE></STREAMMAXBITRATE>
        <STREAMPUBLIC>never</STREAMPUBLIC>
        <STREAMALLOWRELAY>1</STREAMALLOWRELAY>
        <STREAMPUBLICRELAY>1</STREAMPUBLICRELAY>
      </STREAMCONFIG>
    </STREAMCONFIGS>
  </SHOUTCASTSERVER>
```

\

[]{#Nextsongs}

## 2.7. Nextsongs [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the public **/nextsongs** admin option, the XML response
contains a list of titles (if provided by the stream source) of the
titles of the songs which are to be expected to be played after the
currently playing song finishes. The number of song titles returned is
determinded by the stream source so the XML response generated can
contain no titles or it could contain 10 titles or more.

Example:

``` src
<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
  <SHOUTCASTSERVER>
    <NEXTSONGS>
      <!-- the first title in the list begins at "1" and goes up -->
      <TITLE seq="1">The Next Song - To Be Played</TITLE>
      <TITLE seq="2">The Following Song - Or Not To Be Played</TITLE>
      ..
      <!-- XX is the last file returned -->
      <TITLE seq="XX">The Final Song - That Is The Question</TITLE>
    </NEXTSONGS>
  </SHOUTCASTSERVER>
```

\

[]{#Server_Statistics}

## 2.8. Server Statistics [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the public **/statistics** admin option, the XML response
contains a list of the responses returned via /stats for all known
stream configurations and streams which have a connected source (even if
they are not directly specified in the stream configuration).
Additionally it provides consolidated statistics including the total
unique number of listeners connected to the server when viewed across
all of the active streams (if at all).

Example:

``` src
<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
  <SHOUTCASTSERVER>
    <STREAMSTATS>
      <!-- this block is for server wide statistics from all streams -->

      <!-- the total number of streams known by the server -->
      <TOTALSTREAMS>2</TOTALSTREAMS>
      <!-- the total number of active streams (with a source) known by the server -->
      <ACTIVESTREAMS>1</ACTIVESTREAMS>

      <CURRENTLISTENERS>0</CURRENTLISTENERS>
      <PEAKLISTENERS>0</PEAKLISTENERS>
      <!-- the maximum number of listener connections allowed in total to the server -->
      <MAXLISTENERS>32</MAXLISTENERS>
      <!-- the number of unique listener connections across all active streams so if -->
      <!-- one listener is on 2 streams, this will only be counted as one unique listener -->
      <UNIQUELISTENERS>0</UNIQUELISTENERS>
      <!-- average time (seconds) of any active listener connections on all streams -->
      <AVERAGETIME>0</AVERAGETIME>

      <!-- version of the Shoutcast server being used -->
      <VERSION>2.2.0.107 (armv6(rpi))</VERSION>

      <!-- first stream block which relates to /stats?sid=id -->
      <!-- if there are no stream configurations specified or -->
      <!-- no active streams then this would not be present -->
      <STREAM id="1">
        <CURRENTLISTENERS>0</CURRENTLISTENERS>
        <PEAKLISTENERS>0</PEAKLISTENERS>
        <!-- the maximum number of listener connections potentially allowed which depends -->
        <!-- on the maxuser and streammaxuser config options and other stream configs -->
        <MAXLISTENERS>32</MAXLISTENERS>
        <UNIQUELISTENERS>0</UNIQUELISTENERS>
        <!-- average time (seconds) of any active listener connections -->
        <AVERAGETIME>0</AVERAGETIME>

        <!-- these are some information about the stream as shown in listener clients, etc -->
        <SERVERGENRE>Misc</SERVERGENRE>
        <!-- there can also be: SERVERGENRE2, SERVERGENRE3, SERVERGENRE4 and -->
        <!-- SERVERGENRE5 elements depending on how the stream has been setup -->

        <SERVERURL>http://my_website.com</SERVERURL>
        <SERVERTITLE>Test Server</SERVERTITLE>

        <!-- if the Shoutcast source provides current and next song titles then -->
        <!-- they will be listed. if not known then these will be empty entries -->
        <SONGTITLE>The Current Song</SONGTITLE>
        <NEXTTITLE>The Next Song</NEXTTITLE>

        <!-- User ID of the source which typically comes from a Shoutcast 2.x source -->
        <!-- note: this can be present if a 1.x source is in use due to metadata updates -->
        <DJ>DJ Funky</DJ>

        <!-- cumulative total of any attempts to connect to the stream when it is active -->
        <STREAMHITS>0</STREAMHITS>

        <!-- shows 1 if a source is connected and 0 if there is no source -->
        <!-- note: if there is no source then no listener connections occur -->
        <!--       unless a valid backupfile has been configured to be used -->
        <STREAMSTATUS>1</STREAMSTATUS>

        <!-- shows 1 if a backup source is active instead of the main source -->
        <!-- due to connection issues and 0 if the backup source is not used -->
        <!-- note: if there is no source then no listener connections occur -->
        <!--       unless a valid backupfile has been configured to be used -->
        <BACKUPSTATUS>0</BACKUPSTATUS>

        <!-- shows 1 if successfully listed and 0 if not or is private -->
        <STREAMLISTED>1</STREAMLISTED>
        <!-- if there is an error being listed then the code is provided -->
        <!-- here and if there is no error then this is not provided -->
        <STREAMLISTEDERROR>480</STREAMLISTEDERROR>

        // these are only provided if a valid password is provided on the request
        // with information about the current source and backup (if set) provided
        <STREAMSOURCE>123.123.123.123</STREAMSOURCE>
        // this is not provided if there is no backup source specified
        <STREAMBACKUP>my_backup_url:port</STREAMBACKUP>

        <!-- time in seconds the stream has been running -->
        <!-- this is not provided if there is no stream -->
        <STREAMUPTIME>0</STREAMUPTIME>

        <!-- infomation about the format of the stream content and access path-->
        <STREAMPATH>/</STREAMPATH>
        <BITRATE>56</BITRATE>
        <CONTENT>audio/mpeg</CONTENT>
      </STREAM>

      <!-- next stream block which relates to /stats?sid=id -->
      <STREAM id="2">
        <!-- another instance of details -->
      </STREAM>
    </STREAMSTATS>
  </SHOUTCASTSERVER>
```

\

[]{#Bandwidth_Usage}

## 2.9. Bandwidth Usage [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=bandwidth** option, the
XML response contains different metrics showing overall usage down to
the level of specific bandwidth usage. The values returned are as
reliable as can be determined but may not include every piece of data
sent and received or the bandwidth used for the request made (it is
included in the next request made).

    This is a global action and the stream identifier is not required.

Example:

``` src
<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
  <SHOUTCASTSERVER>
    <!-- the total number of bytes sent and received -->
    <TOTAL>4434608</TOTAL>
    <!-- with specific sent and received total which sums up to the total above -->
    <SENT>33498</SENT>
    <RECV>4401110</RECV>
    <!-- duration the DNAS server has been up and running for so it -->
    <!-- is possible to calculate average bandwidth per unit of time -->
    <TIME>365</TIME>

    <!-- the total number of bytes sent to listener clients -->
    <CLIENTSENT>
      <!-- the total number of bytes sent for this metric -->
      <TOTAL>0</TOTAL>
      <!-- followed by 2.x -->
      <V2>0</V2>
      <!-- and 1.x specifics-->
      <V1>0</V1>
    </CLIENTSENT>

    <!-- the total number of bytes received from connected sources -->
    <SOURCERECV>
      <!-- the total number of bytes received for this metric -->
      <TOTAL>4401110</TOTAL>
      <!-- followed by 2.x -->
      <V2>0</V2>
      <!-- and 1.x specifics-->
      <V1>4401110</V1>
    </SOURCERECV>

    <!-- the total number of bytes sent to connected sources e.g. when handshaking -->
    <SOURCESENT>
      <!-- the total number of bytes sent for this metric -->
      <TOTAL>20</TOTAL>
      <!-- followed by 2.x -->
      <V2>0</V2>
      <!-- and 1.x specifics-->
      <V1>20</V1>
    </SOURCESENT>

    <!-- the total number of bytes received from connected relay sources -->
    <RELAYRECV>
      <!-- the total number of bytes received for this metric -->
      <TOTAL>0</TOTAL>
      <!-- bytes received during handshaking when determining the protocol -->
      <MISC>0</MISC>
      <!-- followed by 2.x -->
      <V2>0</V2>
      <!-- and 1.x specifics-->
      <V1>0</V1>
    </RELAYRECV>

    <!-- the total number of bytes sent for any web based requests e.g. /index.html -->
    <WEBPAGES>
      <TOTAL>33478</TOTAL>
      <!-- public pages e.g. /stats or /index.html or /index.css -->
      <PUBLIC>9670</PUBLIC>
      <!-- private pages e.g. /admin.cgi and all pages derived from it -->
      <PRIVATE>23808</PRIVATE>
    </WEBPAGES>

    <!-- the total number of bytes sent or received for all other functionality -->
    <OTHER>
      <TOTAL>0</TOTAL>
      <!-- usage relating to the flash policy server -->
      <FLASH>0</FLASH>
      <!-- bytes sent to connected relay sources e.g. error responses -->
      <RELAYSENTV2>0</RELAYSENTV2>
      <!-- usage relating to DNAS and Directory communications -->
      <YPSENT>0</YPSENT>
      <YPRECV>0</YPRECV>
      <!-- usage relating to adverts and listener client metrics -->
      <AUTH_METRICS>0</AUTH_METRICS>
      <ADVERTS>0</ADVERTS>
    </OTHER>
  </SHOUTCASTSERVER>
```

\

[]{#Directory_Status}

## 2.10. Directory Status [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=ypstatus** option, the
XML response contains a list of the known and configured streams showing
appropriate information about them being listed in the Directory or not
if there are errors. This is a consolidation of the information shown on
the \'Server Administrator\' and \'Stream Administrator\' pages though
is only accessible by the \'Server Administrator\'.

    This is a global action and the stream identifier is not required.

Example:

``` src
<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
  <SHOUTCASTSERVER>

    <!-- the stream has moved and is not accesible -->
    <STREAM id="1">
      <STATUS>MOVED</STATUS>
    </STREAM>

    <!-- the stream has not got an active source connected -->
    <STREAM id="2">
      <STATUS>NOSOURCE</STATUS>
    </STREAM>

    <!-- the stream is running and listed, showing the associated stationid -->
    <STREAM id="3">
      <STATUS>PUBLIC</STATUS>
      <STNID>123456</STNID>
    </STREAM>

    <!-- the stream is running but there was an error listing, showing the Directory error code -->
    <STREAM id="4">
      <STATUS>ERROR</STATUS>
      <CODE>480</CODE>
    </STREAM>

  </SHOUTCASTSERVER>
```

\
The current values returned for the \'status\' value are:

  ---------------------- ------------------------------------------------------------------------------------------------------------
  **NOSOURCE**           There is no source connected, stream is inactive
  **PRIVATE**            The streams is running and is not configured to be listed in the Directory
  **WAITING**            The stream is running and is attempting to connect to the Directory to be listed
  **YP_NOT_FOUND**       The Directory is not accessible and the stream cannot be listed
  **PUBLIC**             The Directory recognised the stream and has listed it (the stationid is provided)
  **ERROR**              The Directory could not accept the stream and has not listed it (the error code is provided)
  **YP_MAINTENANCE**     The Directory is down for maintenance so your stream will not be listed and will behave like it is private
  **EMPTY_AUTHHASH**     There is no authhash specified and the stream is not listed or allowing listeners to connect
  **INVALID_AUTHHASH**   The authhash is incorrectly specified and the stream is not listed or allowing listeners to connect
  ---------------------- ------------------------------------------------------------------------------------------------------------

For more details on the error codes which may be returned by the
Directory can be found
[**here**](http://wiki.shoutcast.com/wiki/SHOUTcast_DNAS_Server_2#YP_Server_Errors).

\

[]{#7.html}

## 2.11. 7.html (Legacy) [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

With 1.x DNAS servers http://\<serverip\>:\<port\>/7.html could be used
to get specific information about the current server instance for status
checking and other uses as a limited set of data.\
\
This is provided in the 2.x DNAS server purely as a legacy response due
to old tooling dependencies and where possible it is recommended to use
the newer responses as they provide an equivalent response which
provides extra information (without being locked to a fixed format) via
the **admin.cgi?sid=#&mode=viewxml&page=1** (private) or
**/stats?sid=#** (public) methods ([see section
2.2](#General_Server_Summary)).

\
The 7.html response provides the following values as a comma separated
list (using the entry names in the equivalent responses):

**currentlisteners , streamstatus , peaklisteners , maxlisteners ,
uniquelisteners , bitrate , songtitle**
