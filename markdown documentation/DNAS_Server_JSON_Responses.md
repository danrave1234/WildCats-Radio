::: header
# Shoutcast DNAS Server JSON / JSON-P Responses {#shoutcast-dnas-server-json-json-p-responses align="center"}

(Last Updated 08 Sep 2018)
:::

+-----------------------------------------------------------------------+
| ::: {#toctitle}                                                       |
| **Contents** [\[[hide](javascript:toggleToc()){#togglelink            |
| .internal}\]]{.toctoggle}                                             |
| :::                                                                   |
|                                                                       |
| - [1 Introduction](#Introduction)                                     |
| - [2 How to Access the JSON                                           |
|   Responses](#How_to_Access_the_JSON_Responses)                       |
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
of the different JSON and JSON-P responses which the DNAS server
(sc_serv) is able to provide to allow access to the information about
current connections or available stream configurations for example.

\

[]{#How_to_Access_the_JSON_Responses}

## 2. How to Access the JSON Responses [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

With the 2.x DNAS server being able to support multiple streams compared
to the single stream which a 1.x DNAS server supports, to access
information for each stream requires you specify the stream identifier
of the stream that you require.

For example to access the General Server Summary ([see section
2.2](#General_Server_Summary)) for stream identifier **#1** then the
following would be used:

    http://<serverip>:<port>/admin.cgi?mode=viewjson&page=1&sid=1

\
or\

    http://<serverip>:<port>/stats?sid=1&json=1

\
or\

    http://<serverip>:<port>/stats?sid=1&json=1&callback=func

To access the same information for stream identifier **#2** then replace
**1** with **2** and so on for any of the streams you want to obtain the
information from.\
\

    Throughout the rest of this document, it is assumed you know how to specify the
    stream identifier you require so only the base part of the url is shown i.e. /stats
    instead of /stats?sid=# where # is the stream identifier. It is also assumed that
    you know to add &callback=func when attempting to retrieve a JSON-P response.

\

[]{#Full_Server_Summary}

## 2.1. Full Server Summary [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=viewjson** option, the
JSON response consists of the general stream details which can be found
over the administration and public summary pages (if access to them is
enabled) in addition to details of the Listener Statistics ([see section
2.3](#Listener_Statistics)) and Song History ([see section
2.4](#Song_History)).

If you only require a specific set of information instead of everything
then you should use the **&page=X** parameter as the JSON response from
this response is a combination of the following responses:

**General Server Summary** ([section 2.2](#General_Server_Summary))\
**Listener Statistics** ([section 2.3](#Listener_Statistics))\
**Song History** ([section 2.4](#Song_History))

\

[]{#General_Server_Summary}

## 2.2. General Server Summary [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=viewjson&page=1** or the
public **/stats?json=1** option, the JSON response consists of the
general stream details which can be found over the administration and
public summary pages (if access to them is enabled). This is a compact
version of what is shown in the \'Full Server Summary\' ([see section
2.1](#Full_Server_Summary)) and acts as the equivalent of 7.html from
the 1.x DNAS server ([see section 3.0](#Equivalent_of_7.html)).

Example:

``` src
  {
    "currentlisteners":0,
    "peaklisteners":0,
    // the maximum number of listener connections potentially allowed which depends
    // on the maxuser and streammaxuser config options and other stream configs
    "maxlisteners":32,
    "uniquelisteners":0,
    // average time (seconds) of any active listener connections
    "averagetime":0,

    // these are some information about the stream as shown in listener clients, etc
    "servergenre":"Misc",
    // there can also be: servergenre2, servergenre3, servergenre4 and 
    // servergenre5 elements depending on how the stream has been setup

    "serverurl":"http:\/\/my_website.com",
    "servertitle":"Test Server",

    // if the Shoutcast source provides current and next song titles then
    // they will be listed. if not known then these will be empty entries
    "songtitle":"The Current Song",
    "nexttitle":"The Next Song",

    // User ID of the source which typically comes from a Shoutcast 2.x source
    // note: this can be present if a 1.x source is in use due to metadata updates
    "dj":"DJ Funky",

    // if the Shoutcast source provides an associated song url e.g. via the updinfo
    // method otherwise it is not included as not all sources usually provide this
    "songurl":"http:\/\/my_website.com\/about_the_song",

    // cumulative total of any attempts to connect to the stream when it is active
    "streamhits":0,

    // shows 1 if a source is connected and 0 if there is no source
    // note: if there is no source then no listener connections occur
    //       unless a valid backupfile has been configured to be used
    "streamstatus":1,

    // shows 1 if a backup source is active instead of the main source
    // due to connection issues and 0 if the backup source is not used
    // note: if there is no source then no listener connections occur
    //       unless a valid backupfile has been configured to be used
    "backupstatus":0,

    // shows 1 if successfully listed and 0 if not or is private
    "streamlisted":1,
    // if there is an error being listed then the code is provided
    // here and if there is no error then this is not provided
    "streamlistederror":480,

    // these are only provided if a valid password is provided on the request
    // with information about the current source and backup (if set) provided
    "streamsource":"123.123.123.123",
    // this is not provided if there is no backup source specified
    "streambackup":"my_backup_url:port",

    // time in seconds the stream has been running
    // this is not provided if there is no stream
    "streamuptime":123,

    // infomation about the format of the stream content and access path
    "streampath":"/highdef",
    "bitrate":"320",
    "content":"audio/aacp",

    // version of the Shoutcast server being used
    "version":"2.4.7.247 (armv6(rpi))"
  }
```

\

[]{#Listener_Statistics}

## 2.3. Listener Statistics [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=viewjson&page=3** option,
the JSON response has details about any currently connected listeners
for the specified stream. If there are no listeners connected then there
will be no entries in the JSON response generated e.g. **\[\]**

Example:

``` src
  [
    {
      "hostname":"127.0.0.1",
      // this is set to **EMPTY** if no user agent was provided by the listener client
      "useragent":"WinampMPEG\/5.66",
      "connecttime":"1337",
      // a unique number for the listener connection used to determine duplicates
      // this is unique whilst the listener client is connected but can be re-used after
      "uid":"01234567"
      // this represents the type of the listener client and anything else internally known
      "type":"1234567"
      // this is the referer header of the listener connection (if provided)
      "referer":"/admin.cgi"
      // this is the X-Forwarded-For header of the listener connection (if provided)
      "xff":""
      // this is the advert group id of the listener connection or zero if not gotten
      "grid":"01234567"
      // this is the number of advert runs which have successfully succeed for the listener
      "triggers":"123"
    }
  ]
```

\

[]{#Song_History}

## 2.4. Song History [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=viewjson&page=4** option,
the JSON response is made from the currently stored played history (if
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
not configured to store them (see above) then there will be no entries
in the JSON response generated e.g. **\[\]**

Example:

``` src
  [
    {
      "playedat":"1302180341",
      "title":"The Previous Title"
    },
    {
      "playedat":"1302175246",
      "title":"The Current Title"
    }
  ]
```

\

[]{#Stream_Metadata}

## 2.5. Stream Metadata [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=viewjson&page=5** option,
the JSON response is the currently stored stream metadata as provided by
the connected stream source or from any manual title updates (e.g. when
using admin.cgi?sid=#&mode=updinfo&song=title) which may have been
received for the stream. This can contain just a title (typical with a
1.x stream source) or it can consist of complete range of metadata as
taken from the audio source when using a 2.x stream source e.g. an MP3
file with a complete ID3 tag.

Example:

``` src
  {
    // this will be the only entry if a Shoutcast 1.x source is connected
    "tit2":"TechnoColor 81 - Astronivo on ETN.fm - 2012-06-15",
    "talb":"The Album Title",
    "tpe1":"The Artist",
    "tyer":"2011",
    "tcon":"Podcast",
    "tenc":"Shoutcast Source DSP v2.3.3.201",
    "trsn":"My Shoutcast Server",
    "wors":"http:\/\/www.shoutcast.com"
  }
```

Detailed information on the supported fields as well as suggested fields
to provide from a 2.x stream source can be found in sc2_xml_metadata.txt
(the field name is the same even though the documentation relates to the
XML response as is internally used for metadata).

\

[]{#Stream_Configurations}

## 2.6. Stream Configurations [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?sid=1&mode=viewjson&page=6**
option, the JSON response is all currently known stream configuration
details (based on the configuration options set in the loaded
configuration file) as well as any global stream configuration options
which are applicable.

    This is a global action and the stream identifier is not be used but is required to
    allow the DNAS server to process the request correctly e.g. set sid=1 in all cases.

Example:

``` src
  {
    // these are global settings / information about the stream configurations
    // if REQUIRECONFIGS is 1 then only source connections matching are allowed
    "requireconfigs":"0",
    "maxlisteners":"32",
    // if set as 0 then there is no limit on the stream(s) bitrate
    "maxbitrate":"128",
    // this is the total number of stream configurations known and enabled
    "total":"1",
    "streams":
    [
      {
        // the value of 'id' relates to 'streamid' and is used to identify the group
        "id":1,
        "authhash":"my_aush_hash_if_entered",
        "path":"\/highdef",
        "relayurl":"",
        "backupurl":"",
        // if set as SERVERMAXLISTENERS then the global SERVERMAXLISTENERS is in use
        "maxlisteners":"maxlisteners",
        // if set as SERVERMAXBITRATE then the global SERVERMAXBITRATE is in use
        "maxbitrate":"",
        "public":"never",
        "allowrelay":"1",
        "publicrelay":"1"
      }
    ]
  }
```

\

[]{#Nextsongs}

## 2.7. Nextsongs [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the public **/nextsongs?json=1** admin option, the JSON
response contains a list of titles (if provided by the stream source) of
the titles of the songs which are to be expected to be played after the
currently playing song finishes. The number of song titles returned is
determinded by the stream source so the JSON response generated can
contain no titles e.g. **\[\]** or it could contain 10 titles or more.

Example:

``` src
  [
    {
      "title":"The Very Next Title"
    },
    {
      "title":"The Title After That"
    }
  ]
```

\

[]{#Server_Statistics}

## 2.8. Server Statistics [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the public **/statistics?json=1** admin option, the JSON
response contains a list of the responses returned via /stats for all
known stream configurations and streams which have a connected source
(even if they are not directly specified in the stream configuration).
Additionally it provides consolidated statistics including the total
unique number of listeners connected to the server when viewed across
all of the active streams (if at all).

Example:

``` src
{
    // this block is for server wide statistics from all streams

    // the total number of streams known by the server
    "totalstreams":2,
    // the total number of active streams (with a source) known by the server
    "activestreams":1,

    "currentlisteners":0,
    "peaklisteners":0,
    // the maximum number of listener connections allowed in total to the server
    "maxlisteners":32,
    // the number of unique listener connections across all active streams so if
    // one listener is on 2 streams, this will only be counted as one unique listener
    "uniquelisteners":0,
    // average time (seconds) of any active listener connections
    "averagetime":0,

    // version of the Shoutcast server being used
    "version":"2.4.7.247 (armv6(rpi))",

    // first stream block which relates to /stats?sid=id&json=1
    // if there are no stream configurations specified or there
    // are no active streams then this would not be present
    "streams":[
      {
        "id":1,
        "currentlisteners":0,
        "peaklisteners":0,
        // the maximum number of listener connections potentially allowed which depends
        // on the maxuser and streammaxuser config options and other stream configs
        "maxlisteners":32,
        "uniquelisteners":0,
        // average time (seconds) of any active listener connections
        "averagetime":0,

        // these are some information about the stream as shown in listener clients, etc
        "servergenre":"Misc",
        // there can also be: servergenre2, servergenre3, servergenre4 and 
        // servergenre5 elements depending on how the stream has been setup

        "serverurl":"http:\/\/my_website.com",
        "servertitle":"Test Server",

        // if the Shoutcast source provides current and next song titles then
        // they will be listed. if not known then these will be empty entries
        "songtitle":"The Current Song",
        "nexttitle":"The Next Song",

        // User ID of the source which typically comes from a Shoutcast 2.x source
        // note: this can be present if a 1.x source is in use due to metadata updates
        "dj":"DJ Funky",

        // cumulative total of any attempts to connect to the stream when it is active
        "streamhits":0,

        // shows 1 if a source is connected and 0 if there is no source
        // note: if there is no source then no listener connections occur
        //       unless a valid backupfile has been configured to be used
        "streamstatus":1,

        // shows 1 if a backup source is active instead of the main source
        // due to connection issues and 0 if the backup source is not used
        // note: if there is no source then no listener connections occur
        //       unless a valid backupfile has been configured to be used
        "backupstatus":0,

        // shows 1 if successfully listed and 0 if not or is private
        "streamlisted":1,
        // if there is an error being listed then the code is provided
        // here and if there is no error then this is not provided
        "streamlistederror":480,

        // these are only provided if a valid password is provided on the request
        // with information about the current source and backup (if set) provided
        "streamsource":"123.123.123.123",
        // this is not provided if there is no backup source specified
        "streambackup":"my_backup_url:port",

        // time in seconds the stream has been running
        // this is not provided if there is no stream
        "streamuptime":123,

        // infomation about the format of the stream content and access path
        "streampath":"\/",
        "bitrate":56,
        "content":"audio/mpeg"
      },
      // next stream block which relates to /stats?sid=id&json=1
      {
        "id":2,
        // another instance of details
      }
    ]
  }
```

\

[]{#Bandwidth_Usage}

## 2.9. Bandwidth Usage [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=bandwidth&type=json**
option, the JSON response contains different metrics showing overall
usage down to the level of specific bandwidth usage. The values returned
are as reliable as can be determined but may not include every piece of
data sent and received or the bandwidth used for the request made (it is
included in the next request made).

    This is a global action and the stream identifier is not required.

Example:

``` src
  {
    // the total number of bytes sent and received
    "total":4434608,
    // with specific sent and received total which sums up to the total above
    "sent":33498,
    "recv":4401110,
    // duration the DNAS server has been up and running for so it
    // is possible to calculate average bandwidth per unit of time
    "time":365,

    // the total number of bytes sent to listener clients
    "clientsent":{
      // the total number of bytes sent for this metric
      "total":0,
      // followed by 2.x
      "v2":0,
      // and 1.x specifics
      "v1":0
    },

    // the total number of bytes received from connected sources
    "sourcerecv":{
      // the total number of bytes sent for this metric
      "total":4401110,
      // followed by 2.x
      "v2":0,
      // and 1.x specifics
      "v1":4401110
    },

    // the total number of bytes sent to connected sources e.g. when handshaking
    "sourcesent":{
      // the total number of bytes sent for this metric
      "total":20,
      // followed by 2.x
      "v2":0,
      // and 1.x specifics
      "v1":20
    },

    // the total number of bytes received from connected relay sources
    "relayrecv":{
      // the total number of bytes sent for this metric
      "total":0,
      // bytes received during handshaking when determining the protocol
      "misc":0,
      // followed by v2
      "2.x":0,
      // and 1.x specifics
      "v1":0
    },

    // the total number of bytes sent for any web based requests e.g. /index.html
    "webpages":{
      "total":33478,
      // public pages e.g. /stats or /index.html or /index.css
      "public":9670,
      // private pages e.g. /admin.cgi and all pages derived from it
      "private":23808
    },

    // the total number of bytes sent or received for all other functionality
    "other":{
      "total":0,
      // usage relating to the flash policy server
      "flash":0,
      // bytes sent to connected relay sources e.g. error responses
      "relaysentv2":0,
      // usage relating to DNAS and Directory communications
      "ypsent":0,
      "yprecv":0,
      // usage relating to adverts and listener client metrics
      "auth_metrics":0,
      "adverts":0
    }
  }
```

\

[]{#Directory_Status}

## 2.10. Directory Status [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When using the administrative **admin.cgi?mode=ypstatus** option, the
JSON response contains a list of the known and configured streams
showing appropriate information about them being listed in the Directory
or not if there are errors. This is a consolidation of the information
shown on the \'Server Administrator\' and \'Stream Administrator\' pages
though is only accessible by the \'Server Administrator\'.

    This is a global action and the stream identifier is not required.

Example:

``` src
  {
    "streams":
    [
      {
        // the stream has moved and is not accesible
        "id":1,
        "status":"moved"
      },
      {
        // the stream has not got an active source connected
        "id":2,
        "status":"nosource"
      },
      {
        // the stream is running and listed, showing the associated stationid
        "id":3,
        "status":"public",
        "stnid":123456
      },
      {
        // the stream is running but there was an error listing, showing the Directory error code
        "id":4,
        "status":"error",
        "code":480
      }
    ]
  }
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
the **admin.cgi?sid=#&mode=viewjson&page=1** (private) or
**/stats?sid=#&json=1** (public) methods ([see section
2.2](#General_Server_Summary)).

\
The 7.html response provides the following values as a comma separated
list (using the entry names in the equivalent responses):

**currentlisteners , streamstatus , peaklisteners , maxlisteners ,
uniquelisteners , bitrate , songtitle**
